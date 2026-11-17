import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { Activity, AiAnalysis, LeaderAssessment, Member, Project, Review, Store, Task, TaskNote, WorkLog } from "@/lib/types";

/** Điền giá trị mặc định cho nhiệm vụ tạo từ phiên bản cũ */
const fullTask = (t: Task): Task => ({
  ...t,
  dueTime: t.dueTime ?? "",
  requirements: t.requirements ?? [],
  supporterIds: t.supporterIds ?? [],
  productLink: t.productLink ?? "",
  approval: t.approval ?? "none",
  approvedAt: t.approvedAt ?? null,
});

type StoredLog = WorkLog & { evidenceText?: string };
const excerpt = (t: string) => t.slice(0, 300);
/** Bỏ toàn văn khi trả danh sách (nhẹ hơn) và điền giá trị mặc định cho dữ liệu cũ. */
const lite = (l: StoredLog): WorkLog => {
  const { evidenceText: _t, ...rest } = l;
  return {
    ...rest,
    evidenceStatus: rest.evidenceStatus ?? (l.link ? "error" : "none"),
    evidenceTitle: rest.evidenceTitle ?? "",
    evidenceExcerpt: rest.evidenceExcerpt ?? "",
  };
};

/**
 * Store lưu vào file JSON (.data/db.json) – dùng khi chạy local, không cần cài gì.
 * KHÔNG dùng được trên Vercel (hệ thống file chỉ đọc) -> khi deploy hãy cấu hình Supabase.
 */

interface DB {
  projects: Project[];
  members: Member[];
  logs: StoredLog[];
  tasks: Task[];
  notes: TaskNote[];
  assessments: LeaderAssessment[];
  activities: Activity[];
  reviews: Review[];
  submissions: { projectId: string; reviewerId: string }[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");
const empty = (): DB => ({ projects: [], members: [], logs: [], tasks: [], notes: [], assessments: [], activities: [], reviews: [], submissions: [] });

let queue: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...empty(), ...JSON.parse(raw) } as DB;
  } catch {
    return empty();
  }
}

async function save(db: DB) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function read<T>(fn: (db: DB) => T): Promise<T> {
  return withLock(async () => fn(await load()));
}

function mutate<T>(fn: (db: DB) => T): Promise<T> {
  return withLock(async () => {
    const db = await load();
    const result = fn(db);
    await save(db);
    return result;
  });
}

export function createFileStore(): Store {
  return {
    createProject: (input) =>
      mutate((db) => {
        const project: Project = {
          id: randomUUID(),
          ...input,
          createdAt: new Date().toISOString(),
          analysis: null,
        };
        db.projects.push(project);
        return project;
      }),

    getProjectByCode: (code) => read((db) => db.projects.find((p) => p.code === code) ?? null),

    setAnalysis: (projectId: string, analysis: AiAnalysis) =>
      mutate((db) => {
        const p = db.projects.find((x) => x.id === projectId);
        if (p) p.analysis = analysis;
      }),

    addMember: (projectId, input) =>
      mutate((db) => {
        const member: Member = {
          id: randomUUID(),
          projectId,
          name: input.name,
          studentId: input.studentId,
          isLeader: input.isLeader,
          token: randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, ""),
          joinedAt: new Date().toISOString(),
          pinHash: input.pinHash,
          failedAttempts: 0,
          lockedUntil: null,
        };
        db.members.push(member);
        return member;
      }),

    updateMember: (projectId, memberId, patch) =>
      mutate((db) => {
        const m = db.members.find((x) => x.projectId === projectId && x.id === memberId);
        if (m) Object.assign(m, patch);
      }),

    getMember: (projectId, memberId) =>
      read((db) => db.members.find((m) => m.projectId === projectId && m.id === memberId) ?? null),

    findMemberByStudentId: (projectId, studentId) =>
      read(
        (db) =>
          db.members.find(
            (m) => m.projectId === projectId && m.studentId.toLowerCase() === studentId.toLowerCase()
          ) ?? null
      ),

    listMembers: (projectId) =>
      read((db) =>
        db.members
          .filter((m) => m.projectId === projectId)
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
      ),

    addLog: (input, evidenceText) =>
      mutate((db) => {
        const log: StoredLog = {
          id: randomUUID(),
          ...input,
          evidenceExcerpt: excerpt(evidenceText),
          evidenceText,
          createdAt: new Date().toISOString(),
        };
        db.logs.push(log);
        return lite(log);
      }),

    getLog: (projectId, logId) =>
      read((db) => {
        const l = db.logs.find((x) => x.projectId === projectId && x.id === logId);
        return l ? { ...lite(l), evidenceText: l.evidenceText ?? "" } : null;
      }),

    updateLogEvidence: (projectId, logId, ev) =>
      mutate((db) => {
        const l = db.logs.find((x) => x.projectId === projectId && x.id === logId);
        if (l) Object.assign(l, { evidenceStatus: ev.status, evidenceTitle: ev.title, evidenceText: ev.text, evidenceExcerpt: excerpt(ev.text) });
      }),

    listEvidenceTexts: (projectId) =>
      read((db) =>
        db.logs
          .filter((l) => l.projectId === projectId && l.evidenceText)
          .map((l) => ({ logId: l.id, text: l.evidenceText as string }))
      ),

    addNote: (projectId, input) =>
      mutate((db) => {
        const note: TaskNote = { id: randomUUID(), projectId, ...input, createdAt: new Date().toISOString() };
        db.notes.push(note);
        return note;
      }),

    listNotes: (projectId) => read((db) => db.notes.filter((n) => n.projectId === projectId)),

    addActivity: (input) =>
      mutate((db) => {
        db.activities.push({ id: randomUUID(), ...input, createdAt: new Date().toISOString() });
      }),

    listActivities: (projectId, limit) =>
      read((db) =>
        db.activities
          .filter((a) => a.projectId === projectId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, limit)
      ),

    updateLog: (projectId, logId, patch, ev) =>
      mutate((db) => {
        const l = db.logs.find((x) => x.projectId === projectId && x.id === logId);
        if (!l) return;
        Object.assign(l, patch);
        if (ev) Object.assign(l, { evidenceStatus: ev.status, evidenceTitle: ev.title, evidenceText: ev.text, evidenceExcerpt: excerpt(ev.text) });
      }),

    deleteLog: (projectId, logId, memberId) =>
      mutate((db) => {
        const before = db.logs.length;
        db.logs = db.logs.filter((l) => !(l.id === logId && l.projectId === projectId && l.memberId === memberId));
        return db.logs.length < before;
      }),

    listLogs: (projectId) =>
      read((db) =>
        db.logs
          .filter((l) => l.projectId === projectId)
          .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt))
          .map(lite)
      ),

    addTask: (projectId, input) =>
      mutate((db) => {
        const task: Task = {
          id: randomUUID(),
          projectId,
          ...input,
          status: "todo",
          createdAt: new Date().toISOString(),
          doneAt: null,
          productLink: "",
          approval: "none",
          approvedAt: null,
        };
        db.tasks.push(task);
        return task;
      }),

    getTask: (projectId, taskId) =>
      read((db) => {
        const t = db.tasks.find((x) => x.projectId === projectId && x.id === taskId);
        return t ? fullTask(t) : null;
      }),

    updateTask: (projectId, taskId, patch) =>
      mutate((db) => {
        const t = db.tasks.find((x) => x.projectId === projectId && x.id === taskId);
        if (!t) return null;
        Object.assign(t, patch);
        if (patch.status) t.doneAt = patch.status === "done" ? new Date().toISOString() : null;
        if (patch.approval) t.approvedAt = patch.approval === "approved" ? new Date().toISOString() : null;
        return fullTask({ ...t });
      }),

    deleteTask: (projectId, taskId) =>
      mutate((db) => {
        const before = db.tasks.length;
        db.tasks = db.tasks.filter((t) => !(t.projectId === projectId && t.id === taskId));
        return db.tasks.length < before;
      }),

    listTasks: (projectId) =>
      read((db) =>
        db.tasks
          .filter((t) => t.projectId === projectId)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map(fullTask)
      ),

    upsertAssessment: (a) =>
      mutate((db) => {
        db.assessments = db.assessments.filter((x) => !(x.projectId === a.projectId && x.memberId === a.memberId));
        const row: LeaderAssessment = { ...a, updatedAt: new Date().toISOString() };
        db.assessments.push(row);
        return row;
      }),

    listAssessments: (projectId) => read((db) => db.assessments.filter((x) => x.projectId === projectId)),

    submitReviews: (projectId, reviewerId, reviews) =>
      mutate((db) => {
        if (db.submissions.some((s) => s.projectId === projectId && s.reviewerId === reviewerId)) return false;
        db.submissions.push({ projectId, reviewerId });
        // Chèn ở vị trí ngẫu nhiên để thứ tự trong file không lộ thứ tự nộp
        for (const r of reviews) {
          const row: Review = { id: randomUUID(), projectId, ...r };
          db.reviews.splice(Math.floor(Math.random() * (db.reviews.length + 1)), 0, row);
        }
        return true;
      }),

    listSubmitted: (projectId) =>
      read((db) => db.submissions.filter((s) => s.projectId === projectId).map((s) => s.reviewerId)),

    listReviews: (projectId) => read((db) => db.reviews.filter((r) => r.projectId === projectId)),
  };
}
