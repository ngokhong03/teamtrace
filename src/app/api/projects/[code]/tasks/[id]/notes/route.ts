import { getStore } from "@/lib/store";
import { HttpError, authenticate, readJson, route, text } from "@/lib/http";
import { record } from "@/lib/activity";

export const dynamic = "force-dynamic";

const MAX_NOTES_PER_TASK = 50;

/** Ghi chú vào nhiệm vụ: người phụ trách, người hỗ trợ hoặc trưởng nhóm. */
export const POST = route(async (req: Request, p: { code: string; id: string }) => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const task = await store.getTask(project.id, p.id);
  if (!task) throw new HttpError(404, "Không tìm thấy nhiệm vụ");
  const canWrite = task.assigneeId === member.id || task.supporterIds.includes(member.id) || member.isLeader;
  if (!canWrite) {
    throw new HttpError(403, "Bạn chỉ ghi chú được vào nhiệm vụ mình phụ trách hoặc hỗ trợ");
  }
  const body = await readJson(req);
  const content = text(body.content, "Ghi chú", { min: 1, max: 500 });

  const existing = (await store.listNotes(project.id)).filter((n) => n.taskId === task.id);
  if (existing.length >= MAX_NOTES_PER_TASK) throw new HttpError(400, "Nhiệm vụ này đã có quá nhiều ghi chú");

  const note = await store.addNote(project.id, { taskId: task.id, memberId: member.id, content });
  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "task_note",
    taskId: task.id,
    logId: null,
    summary: `ghi chú vào “${task.title}”`,
    detail: { title: task.title, content: content.slice(0, 300) },
  });
  return { note };
});
