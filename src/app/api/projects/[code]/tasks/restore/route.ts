import { getStore } from "@/lib/store";
import { HttpError, authenticate, readJson, route } from "@/lib/http";
import { record } from "@/lib/activity";
import type { Task } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Khôi phục nhiệm vụ đã xoá (chỉ trưởng nhóm), dựa trên bản sao lưu trong Lịch sử.
 * Nhiệm vụ xoá trước khi có tính năng này chỉ còn tên + người phụ trách → khôi phục ở trạng thái "Chưa làm".
 */
export const POST = route(async (req: Request, p: { code: string }) => {
  const { project, member } = await authenticate(req, p.code);
  if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới khôi phục được nhiệm vụ");
  const body = await readJson(req);
  const activityId = String(body.activityId ?? "");
  const store = getStore();
  const acts = await store.listActivities(project.id, 1000);
  const act = acts.find((a) => a.id === activityId && a.type === "task_deleted");
  if (!act) throw new HttpError(404, "Không tìm thấy nhiệm vụ đã xoá");
  if (acts.some((a) => a.detail?.restoredFrom === activityId)) throw new HttpError(409, "Nhiệm vụ này đã được khôi phục rồi");

  const d = act.detail as Record<string, any>;
  const snap = (d.snapshot ?? {}) as Partial<Task>;
  const members = await store.listMembers(project.id);
  const isMember = (id: unknown) => typeof id === "string" && members.some((m) => m.id === id);
  const assigneeId = isMember(snap.assigneeId ?? d.assigneeId) ? String(snap.assigneeId ?? d.assigneeId) : member.id;
  const title = String(snap.title ?? d.title ?? "Nhiệm vụ đã khôi phục").slice(0, 150);

  const task = await store.addTask(project.id, {
    title,
    description: String(snap.description ?? ""),
    assigneeId,
    createdBy: isMember(snap.createdBy) ? String(snap.createdBy) : member.id,
    dueDate: snap.dueDate ?? "",
    dueTime: snap.dueTime ?? "",
    requirements: Array.isArray(snap.requirements) ? snap.requirements.map(String) : [],
    supporterIds: Array.isArray(snap.supporterIds) ? snap.supporterIds.filter(isMember).map(String) : [],
  });
  const patch: Record<string, unknown> = {};
  if (snap.status && snap.status !== "todo") patch.status = snap.status;
  if (snap.productLink) patch.productLink = snap.productLink;
  if (snap.approval && snap.approval !== "none") patch.approval = snap.approval;
  const restored = Object.keys(patch).length ? await store.updateTask(project.id, task.id, patch) : task;

  for (const n of Array.isArray(d.notes) ? d.notes : []) {
    if (isMember(n?.memberId) && typeof n?.content === "string" && n.content.trim()) {
      await store.addNote(project.id, { taskId: task.id, memberId: n.memberId, content: n.content });
    }
  }

  await record(store, {
    projectId: project.id,
    actorId: member.id,
    type: "task_assigned",
    taskId: task.id,
    logId: null,
    summary: `khôi phục nhiệm vụ “${title}”`,
    detail: { title, assigneeId, restoredFrom: activityId },
  });
  return { task: restored };
});
