import { getStore } from "@/lib/store";
import { HttpError, authenticate, isoDate, readJson, route, str, text } from "@/lib/http";
import { TASK_STATUSES, type TaskPatch, type TaskStatus } from "@/lib/types";

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
  }

  const editsContent = body.title !== undefined || body.description !== undefined || body.dueDate !== undefined;
  if (editsContent) {
    if (!member.isLeader && task.createdBy !== member.id) {
      throw new HttpError(403, "Chỉ trưởng nhóm hoặc người tạo việc mới được sửa nhiệm vụ");
    }
    if (body.title !== undefined) patch.title = str(body.title, "Tên nhiệm vụ", { min: 2, max: 150 });
    if (body.description !== undefined) patch.description = text(body.description, "Mô tả", { max: 600, optional: true });
    if (body.dueDate !== undefined) patch.dueDate = isoDate(body.dueDate, "Hạn nộp", true);
  }

  if (body.assigneeId !== undefined) {
    if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới được đổi người được giao");
    const a = await store.getMember(project.id, String(body.assigneeId));
    if (!a) throw new HttpError(400, "Người được giao không thuộc nhóm này");
    patch.assigneeId = a.id;
  }

  if (Object.keys(patch).length === 0) throw new HttpError(400, "Không có gì để cập nhật");
  const updated = await store.updateTask(project.id, task.id, patch);
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
  return { ok: true };
});
