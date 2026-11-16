import { getStore } from "@/lib/store";
import { HttpError, authenticate, isoDate, optionalUrl, readJson, requirementList, route, str, text, timeOfDay } from "@/lib/http";
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskPatch, type TaskStatus } from "@/lib/types";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";

type Ctx = { code: string; id: string };

/**
 * Cập nhật nhiệm vụ.
 * - Đổi trạng thái: người được giao hoặc trưởng nhóm.
 * - Sửa tên / mô tả / hạn: trưởng nhóm hoặc người tạo việc.
 * - Đổi người được giao: chỉ trưởng nhóm.
 */
export const PATCH = route(async (req: Request, p: Ctx) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const task = await store.getTask(project.id, p.id);
  if (!task) throw new HttpError(404, "Không tìm thấy nhiệm vụ");
  const body = await readJson(req);

  const patch: TaskPatch = {};

  if (body.status !== undefined) {
    if (!(TASK_STATUSES as readonly string[]).includes(String(body.status))) {
      throw new HttpError(400, "Trạng thái không hợp lệ");
    }
    if (task.assigneeId !== member.id && !member.isLeader) {
      throw new HttpError(403, "Chỉ người được giao hoặc trưởng nhóm mới đổi được trạng thái");
    }
    patch.status = body.status as TaskStatus;
    // Trạng thái thay đổi thì kết quả duyệt cũ không còn giá trị
    if (patch.status !== task.status) patch.approval = "none";
  }

  // Link sản phẩm: người phụ trách hoặc trưởng nhóm
  if (body.productLink !== undefined) {
    if (task.assigneeId !== member.id && !member.isLeader) {
      throw new HttpError(403, "Chỉ người phụ trách hoặc trưởng nhóm mới cập nhật link sản phẩm");
    }
    patch.productLink = optionalUrl(body.productLink, "Link sản phẩm");
  }

  // Duyệt (Completed & Approved) hoặc yêu cầu sửa: chỉ trưởng nhóm
  if (body.approval !== undefined) {
    if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới duyệt nhiệm vụ");
    if (body.approval === "approved") {
      if ((patch.status ?? task.status) !== "done") throw new HttpError(400, "Chỉ duyệt được nhiệm vụ đã hoàn thành");
      patch.approval = "approved";
    } else if (body.approval === "revise") {
      patch.approval = "revise";
      patch.status = "doing";
    } else {
      throw new HttpError(400, "Kết quả duyệt không hợp lệ");
    }
  }

  const editsContent =
    body.title !== undefined ||
    body.description !== undefined ||
    body.dueDate !== undefined ||
    body.dueTime !== undefined ||
    body.requirements !== undefined ||
    body.supporterIds !== undefined;
  if (editsContent) {
    if (!member.isLeader && task.createdBy !== member.id) {
      throw new HttpError(403, "Chỉ trưởng nhóm hoặc người tạo việc mới được sửa nhiệm vụ");
    }
    if (body.title !== undefined) patch.title = str(body.title, "Tên nhiệm vụ", { min: 2, max: 150 });
    if (body.description !== undefined) patch.description = text(body.description, "Mô tả", { max: 600, optional: true });
    if (body.dueDate !== undefined) patch.dueDate = isoDate(body.dueDate, "Hạn nộp", true);
    if (body.dueTime !== undefined) patch.dueTime = timeOfDay(body.dueTime);
    if (body.requirements !== undefined) patch.requirements = requirementList(body.requirements);
    if (body.supporterIds !== undefined) {
      const members = await store.listMembers(project.id);
      const ids = [...new Set((Array.isArray(body.supporterIds) ? body.supporterIds : []).map(String))];
      if (ids.some((id) => !members.some((m) => m.id === id))) throw new HttpError(400, "Người hỗ trợ không thuộc nhóm này");
      patch.supporterIds = ids.filter((id) => id !== (patch.assigneeId ?? task.assigneeId));
    }
  }

  if (body.assigneeId !== undefined) {
    if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới được đổi người được giao");
    const a = await store.getMember(project.id, String(body.assigneeId));
    if (!a) throw new HttpError(400, "Người được giao không thuộc nhóm này");
    patch.assigneeId = a.id;
  }

  if (Object.keys(patch).length === 0) throw new HttpError(400, "Không có gì để cập nhật");
  const updated = await store.updateTask(project.id, task.id, patch);
  if (patch.approval === "approved" || (patch.approval === "revise" && body.approval === "revise")) {
    await record(store, {
      projectId: project.id,
      actorId: member.id,
      type: "task_review",
      taskId: task.id,
      logId: null,
      summary: patch.approval === "approved" ? `duyệt “${task.title}” (Completed & Approved)` : `yêu cầu sửa lại “${task.title}”`,
      detail: { title: task.title, approval: patch.approval },
    });
  } else if (patch.status && patch.status !== task.status) {
    await record(store, {
      projectId: project.id,
      actorId: member.id,
      type: "task_status",
      taskId: task.id,
      logId: null,
      summary: `chuyển “${task.title}” sang ${TASK_STATUS_LABELS[patch.status]}`,
      detail: { title: task.title, from: task.status, to: patch.status },
    });
  }
  return { task: updated };
});

/** Xoá nhiệm vụ: trưởng nhóm hoặc người tạo việc. */
export const DELETE = route(async (req: Request, p: Ctx) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const task = await store.getTask(project.id, p.id);
  if (!task) throw new HttpError(404, "Không tìm thấy nhiệm vụ");
  if (!member.isLeader && task.createdBy !== member.id) {
    throw new HttpError(403, "Chỉ trưởng nhóm hoặc người tạo việc mới được xoá nhiệm vụ");
  }
  await store.deleteTask(project.id, task.id);
  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "task_deleted",
    taskId: task.id,
    logId: null,
    summary: `xoá nhiệm vụ “${task.title}”`,
    detail: { title: task.title, assigneeId: task.assigneeId },
  });
  return { ok: true };
});
