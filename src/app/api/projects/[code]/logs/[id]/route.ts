import { getStore } from "@/lib/store";
import { HttpError, authenticate, isoDate, readJson, route, str, text } from "@/lib/http";
import { CATEGORIES, type LogPatch } from "@/lib/types";
import { readEvidence } from "@/lib/evidence";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type P = { code: string; id: string };

/** Xem chi tiết một công việc kèm toàn văn nội dung minh chứng đã đọc: người ghi hoặc trưởng nhóm. */
export const GET = route(async (req: Request, p: P) => {
  const { project, member } = await authenticate(req, p.code);
  const log = await getStore().getLog(project.id, p.id);
  if (!log) throw new HttpError(404, "Không tìm thấy công việc");
  if (log.memberId !== member.id && !member.isLeader) {
    throw new HttpError(403, "Chỉ trưởng nhóm hoặc người ghi nhận mới xem được nội dung minh chứng");
  }
  return { log };
});

/**
 * - { recheck: true }: đọc lại link minh chứng (người ghi hoặc trưởng nhóm).
 * - Sửa nội dung (tên, mô tả, link, loại, %, ngày): chỉ người ghi. Đổi link thì đọc lại minh chứng.
 */
export const PATCH = route(async (req: Request, p: P) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const body = await readJson(req);
  const log = await store.getLog(project.id, p.id);
  if (!log) throw new HttpError(404, "Không tìm thấy công việc");

  if (body.recheck !== true) {
    if (log.memberId !== member.id) throw new HttpError(403, "Chỉ người ghi nhận mới sửa được công việc này");
    const patch: LogPatch = {};
    if (body.task !== undefined) patch.task = str(body.task, "Tên đầu việc", { min: 2, max: 150 });
    if (body.description !== undefined) patch.description = text(body.description, "Mô tả", { min: 10, max: 1500 });
    if (body.category !== undefined) {
      patch.category = (CATEGORIES as readonly string[]).includes(String(body.category)) ? String(body.category) : "Khác";
    }
    if (body.percent !== undefined) {
      const percent = Number(body.percent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new HttpError(400, "% hoàn thành phải từ 0 đến 100");
      patch.percent = Math.round(percent);
    }
    if (body.workDate !== undefined) {
      const workDate = isoDate(body.workDate, "Ngày thực hiện");
      const diffDays = (Date.parse(workDate) - Date.now()) / 86_400_000;
      if (diffDays > 1 || diffDays < -60) throw new HttpError(400, "Ngày thực hiện không hợp lệ");
      patch.workDate = workDate;
    }
    let ev;
    if (body.link !== undefined) {
      const link = typeof body.link === "string" ? body.link.trim() : "";
      if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, "Link minh chứng phải bắt đầu bằng http:// hoặc https://");
      if (link.length > 500) throw new HttpError(400, "Link quá dài");
      if (link !== log.link) {
        patch.link = link;
        ev = await readEvidence(link);
      }
    }
    if (!Object.keys(patch).length) throw new HttpError(400, "Không có gì để cập nhật");
    await store.updateLog(project.id, log.id, patch, ev);
    await record(store, {
      projectId: project.id,
      actorId: member.id,
      type: "log_added",
      taskId: null,
      logId: log.id,
      summary: `sửa công việc: ${patch.task ?? log.task}`,
      detail: {
        edited: true,
        before: { task: log.task, description: log.description.slice(0, 500), link: log.link, percent: log.percent },
        task: patch.task ?? log.task,
        link: patch.link ?? log.link,
        percent: patch.percent ?? log.percent,
      },
    });
    const updated = await store.getLog(project.id, log.id);
    return { log: updated ? { ...updated, evidenceText: undefined } : null };
  }

  if (log.memberId !== member.id && !member.isLeader) {
    throw new HttpError(403, "Chỉ trưởng nhóm hoặc người ghi nhận mới đọc lại được link");
  }
  const ev = await readEvidence(log.link);
  await store.updateLogEvidence(project.id, log.id, ev);
  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "evidence_rechecked",
    taskId: null,
    logId: log.id,
    summary: `đọc lại minh chứng: ${log.task}`,
    detail: { task: log.task, link: log.link, evidenceStatus: ev.status },
  });
  return { evidenceStatus: ev.status, evidenceTitle: ev.title, evidenceExcerpt: ev.text.slice(0, 300) };
});

/** Mỗi người chỉ xoá được log của chính mình. Lịch sử vẫn giữ bản ghi đã xoá cho trưởng nhóm. */
export const DELETE = route(async (req: Request, p: P) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const log = await store.getLog(project.id, p.id);
  const ok = log ? await store.deleteLog(project.id, p.id, member.id) : false;
  if (!ok || !log) throw new HttpError(404, "Không tìm thấy công việc hoặc bạn không có quyền xoá");
  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "log_deleted",
    taskId: null,
    logId: log.id,
    summary: `xoá công việc: ${log.task}`,
    detail: {
      task: log.task,
      description: log.description.slice(0, 500),
      link: log.link,
      hours: log.hours,
      percent: log.percent,
      workDate: log.workDate,
    },
  });
  return { ok: true };
});
