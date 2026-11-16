import { getStore } from "@/lib/store";
import { HttpError, authenticate, isoDate, readJson, route, str, text } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_TASKS = 200;

/**
 * Giao việc.
 * - Trưởng nhóm: giao cho bất kỳ thành viên nào.
 * - Thành viên thường: chỉ được tự nhận việc cho chính mình.
 */
export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const { project, member } = await authenticate(req, ctx.params.code);
  const store = getStore();
  const body = await readJson(req);

  const title = str(body.title, "Tên nhiệm vụ", { min: 2, max: 150 });
  const description = text(body.description, "Mô tả", { max: 600, optional: true });
  const dueDate = isoDate(body.dueDate, "Hạn nộp", true);

  const assigneeId = typeof body.assigneeId === "string" && body.assigneeId ? body.assigneeId : member.id;
  if (assigneeId !== member.id && !member.isLeader) {
    throw new HttpError(403, "Chỉ trưởng nhóm mới được giao việc cho người khác. Bạn có thể tự nhận việc cho mình.");
  }
  const assignee = await store.getMember(project.id, assigneeId);
  if (!assignee) throw new HttpError(400, "Người được giao không thuộc nhóm này");

  if ((await store.listTasks(project.id)).length >= MAX_TASKS) {
    throw new HttpError(400, `Dự án đã có tối đa ${MAX_TASKS} nhiệm vụ`);
  }

  const task = await store.addTask(project.id, { title, description, assigneeId, createdBy: member.id, dueDate });
  return { task };
});
