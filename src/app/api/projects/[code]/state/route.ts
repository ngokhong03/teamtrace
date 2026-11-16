import { getStore } from "@/lib/store";
import { authenticate, route } from "@/lib/http";
import type { StateResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request, p: { code: string }): Promise<StateResponse> => {
  const { project, member } = await authenticate(req, p.code);
  const store = getStore();
  const [members, logs, submitted, tasks] = await Promise.all([
    store.listMembers(project.id),
    store.listLogs(project.id),
    store.listSubmitted(project.id),
    store.listTasks(project.id),
  ]);
  const done = new Set(submitted);
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
      submitted: done.has(member.id),
    },
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      studentId: m.studentId,
      isLeader: m.isLeader,
      submitted: done.has(m.id),
    })),
    logs,
    tasks,
  };
});
