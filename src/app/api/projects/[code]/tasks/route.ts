import { getStore } from "@/lib/store";
import { HttpError, authenticate, isoDate, readJson, route, str, text } from "@/lib/http";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MAX_TASKS = 200;

/**
 * Giao việc: CHỈ trưởng nhóm. Thành viên không tự tạo nhiệm vụ, chỉ ghi chú vào nhiệm vụ được giao.
 */
export const POST = route(async (req: Request, p: { code: string }) => {
  const { project, member } = await authenticate(req, p.code);
  if (!member.isLeader) {
    throw new HttpError(403, "Chỉ trưởng nhóm mới được giao việc. Bạn có thể ghi chú vào nhiệm vụ được giao cho mình.");
  }
  const store = getStore();
  const body = await readJson(req);

  const title = str(body.title, "Tên nhiệm vụ", { min: 2, max: 150 });
  const description = text(body.description, "Mô tả", { max: 600, optional: true });
  const dueDate = isoDate(body.dueDate, "Hạn nộp", true);

  const assigneeId = typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : member.id;
  const assignee = await store.getMember(project.id, assigneeId);
  if (!assignee) throw new HttpError(400, "Người được giao không thuộc nhóm này");

  if ((await store.listTasks(project.id)).length >= MAX_TASKS) {
    throw new HttpError(400, `Dự án đã có tối đa ${MAX_TASKS} nhiệm vụ`);
  }

  const task = await store.addTask(project.id, { title, description, assigneeId, createdBy: member.id, dueDate });
  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "task_assigned",
    taskId: task.id,
    logId: null,
    summary: `giao việc “${title}” cho ${assignee.name}`,
    detail: { title, assigneeId, assigneeName: assignee.name, dueDate },
  });
  return { task };
});
