import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { AiAnalysis, Member, Project, Review, Store, WorkLog } from "@/lib/types";

/**
 * Store lưu vào file JSON (.data/db.json) – dùng khi chạy local, không cần cài gì.
 * KHÔNG dùng được trên Vercel (hệ thống file chỉ đọc) -> khi deploy hãy cấu hình Supabase.
 */

interface DB {
  projects: Project[];
  members: Member[];
  logs: WorkLog[];
  reviews: Review[];
  submissions: { projectId: string; reviewerId: string }[];
}

const FILE = path.join(process.cwd(), ".data", "db.json");
const empty = (): DB => ({ projects: [], members: [], logs: [], reviews: [], submissions: [] });

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

    addLog: (input) =>
      mutate((db) => {
        const log: WorkLog = { id: randomUUID(), ...input, createdAt: new Date().toISOString() };
        db.logs.push(log);
        return log;
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
      ),

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
