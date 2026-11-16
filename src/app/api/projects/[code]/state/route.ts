import { getStore } from "@/lib/store";
import { authenticate, route } from "@/lib/http";
import type { ActivityType, StateResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Sự kiện chỉ trưởng nhóm thấy (để kiểm soát), thành viên thường không thấy. */
const LEADER_ONLY: ActivityType[] = ["log_deleted", "evidence_rechecked"];

export const GET = route(async (req: Request, p: { code: string }): Promise<StateResponse> => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const [members, logs, submitted, tasks, notes, activities, assessments] = await Promise.all([
    store.listMembers(project.id),
    store.listLogs(project.id),
    store.listSubmitted(project.id),
    store.listTasks(project.id),
    store.listNotes(project.id),
    store.listActivities(project.id, member.isLeader ? 300 : 150),
    store.listAssessments(project.id),
  ]);
  return {
    project: {
      code: project.code,
      name: project.name,
      course: project.course,
      deadline: project.deadline,
      createdAt: project.createdAt,
    },
    me: {
      id: member.id,
      name: member.name,
      studentId: member.studentId,
      isLeader: member.isLeader,
      submitted: submitted.includes(member.id),
    },
    // Không trả trạng thái đã/chưa đánh giá của từng người – chỉ con số tổng
    members: members.map((m) => ({ id: m.id, name: m.name, studentId: m.studentId, isLeader: m.isLeader })),
    submittedCount: submitted.length,
    logs,
    tasks,
    notes,
    activities: member.isLeader ? activities : activities.filter((a) => !LEADER_ONLY.includes(a.type)),
    // Đánh giá của trưởng nhóm: trưởng nhóm thấy hết, thành viên chỉ thấy đánh giá về mình
    assessments: member.isLeader ? assessments : assessments.filter((a) => a.memberId === member.id),
  };
});
