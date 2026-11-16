import { getStore } from "@/lib/store";
import { HttpError, authenticate, readJson, route } from "@/lib/http";
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

/** Đọc lại link minh chứng (ví dụ sau khi đã bật chia sẻ): người ghi hoặc trưởng nhóm. */
export const PATCH = route(async (req: Request, p: P) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const body = await readJson(req);
  if (body.recheck !== true) throw new HttpError(400, "Không có gì để cập nhật");
  const log = await store.getLog(project.id, p.id);
  if (!log) throw new HttpError(404, "Không tìm thấy công việc");
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
