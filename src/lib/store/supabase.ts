import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { AiAnalysis, Member, Project, Review, Store, Task, WorkLog } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function check<T>(res: { data: T | null; error: { message: string } | null }, ctx: string): T {
  if (res.error) throw new Error(`[Supabase] ${ctx}: ${res.error.message}`);
  return res.data as T;
}

const toProject = (r: any): Project => ({
  id: r.id,
  code: r.code,
  name: r.name,
  course: r.course ?? "",
  deadline: r.deadline ?? "",
  createdAt: r.created_at,
  analysis: r.analysis ?? null,
});

const toMember = (r: any): Member => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  studentId: r.student_id,
  token: r.token,
  isLeader: r.is_leader,
  joinedAt: r.joined_at,
  pinHash: r.pin_hash ?? null,
  failedAttempts: r.failed_attempts ?? 0,
  lockedUntil: r.locked_until ?? null,
});

const toLog = (r: any): WorkLog => ({
  id: r.id,
  projectId: r.project_id,
  memberId: r.member_id,
  task: r.task,
  description: r.description ?? "",
  link: r.link ?? "",
  category: r.category ?? "Khác",
  hours: Number(r.hours),
  percent: Number(r.percent),
  workDate: r.work_date,
  createdAt: r.created_at,
});

const toTask = (r: any): Task => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description ?? "",
  assigneeId: r.assignee_id,
  createdBy: r.created_by ?? r.assignee_id,
  dueDate: r.due_date ?? "",
  status: r.status,
  createdAt: r.created_at,
  doneAt: r.done_at ?? null,
});

const toReview = (r: any): Review => ({
  id: r.id,
  projectId: r.project_id,
  revieweeId: r.reviewee_id,
  responsibility: r.responsibility,
  quality: r.quality,
  collaboration: r.collaboration,
  comment: r.comment ?? "",
});

export function createSupabaseStore(url: string, serviceKey: string): Store {
  const db: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js 14 tự cache mọi fetch() phía server -> đọc lại sẽ ra dữ liệu cũ sau khi ghi.
    // Bắt buộc tắt cache cho các truy vấn Supabase.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });

  return {
    async createProject(input) {
      const res = await db
        .from("projects")
        .insert({ code: input.code, name: input.name, course: input.course, deadline: input.deadline || null })
        .select()
        .single();
      return toProject(check(res, "createProject"));
    },

    async getProjectByCode(code) {
      const res = await db.from("projects").select("*").eq("code", code).maybeSingle();
      const row = check(res, "getProjectByCode");
      return row ? toProject(row) : null;
    },

    async setAnalysis(projectId: string, analysis: AiAnalysis) {
      const res = await db.from("projects").update({ analysis }).eq("id", projectId);
      check({ data: true, error: res.error }, "setAnalysis");
    },

    async addMember(projectId, input) {
      const res = await db
        .from("members")
        .insert({
          project_id: projectId,
          name: input.name,
          student_id: input.studentId,
          is_leader: input.isLeader,
          token: randomBytes(24).toString("hex"),
          pin_hash: input.pinHash,
        })
        .select()
        .single();
      return toMember(check(res, "addMember"));
    },

    async updateMember(projectId, memberId, patch) {
      const row: Record<string, unknown> = {};
      if (patch.pinHash !== undefined) row.pin_hash = patch.pinHash;
      if (patch.failedAttempts !== undefined) row.failed_attempts = patch.failedAttempts;
      if (patch.lockedUntil !== undefined) row.locked_until = patch.lockedUntil;
      const res = await db.from("members").update(row).eq("project_id", projectId).eq("id", memberId);
      check({ data: true, error: res.error }, "updateMember");
    },

    async getMember(projectId, memberId) {
      // id không phải uuid sẽ làm Postgres báo lỗi -> coi như không tìm thấy
      if (!/^[0-9a-f-]{36}$/i.test(memberId)) return null;
      const res = await db.from("members").select("*").eq("project_id", projectId).eq("id", memberId).maybeSingle();
      const row = check(res, "getMember");
      return row ? toMember(row) : null;
    },

    async findMemberByStudentId(projectId, studentId) {
      const res = await db
        .from("members")
        .select("*")
        .eq("project_id", projectId)
        .ilike("student_id", studentId.replace(/[%_\\]/g, (c) => "\\" + c))
        .maybeSingle();
      const row = check(res, "findMemberByStudentId");
      return row ? toMember(row) : null;
    },

    async listMembers(projectId) {
      const res = await db.from("members").select("*").eq("project_id", projectId).order("joined_at");
      return (check(res, "listMembers") as any[]).map(toMember);
    },

    async addLog(input) {
      const res = await db
        .from("work_logs")
        .insert({
          project_id: input.projectId,
          member_id: input.memberId,
          task: input.task,
          description: input.description,
          link: input.link,
          category: input.category,
          hours: input.hours,
          percent: input.percent,
          work_date: input.workDate,
        })
        .select()
        .single();
      return toLog(check(res, "addLog"));
    },

    async deleteLog(projectId, logId, memberId) {
      if (!/^[0-9a-f-]{36}$/i.test(logId)) return false;
      const res = await db
        .from("work_logs")
        .delete()
        .eq("id", logId)
        .eq("project_id", projectId)
        .eq("member_id", memberId)
        .select("id");
      return (check(res, "deleteLog") as any[]).length > 0;
    },

    async listLogs(projectId) {
      const res = await db
        .from("work_logs")
        .select("*")
        .eq("project_id", projectId)
        .order("work_date", { ascending: false })
        .order("created_at", { ascending: false });
      return (check(res, "listLogs") as any[]).map(toLog);
    },

    async addTask(projectId, input) {
      const res = await db
        .from("tasks")
        .insert({
          project_id: projectId,
          title: input.title,
          description: input.description,
          assignee_id: input.assigneeId,
          created_by: input.createdBy,
          due_date: input.dueDate || null,
        })
        .select()
        .single();
      return toTask(check(res, "addTask"));
    },

    async getTask(projectId, taskId) {
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;
      const res = await db.from("tasks").select("*").eq("project_id", projectId).eq("id", taskId).maybeSingle();
      const row = check(res, "getTask");
      return row ? toTask(row) : null;
    },

    async updateTask(projectId, taskId, patch) {
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return null;
      const row: Record<string, unknown> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.assigneeId !== undefined) row.assignee_id = patch.assigneeId;
      if (patch.dueDate !== undefined) row.due_date = patch.dueDate || null;
      if (patch.status !== undefined) {
        row.status = patch.status;
        row.done_at = patch.status === "done" ? new Date().toISOString() : null;
      }
      const res = await db
        .from("tasks")
        .update(row)
        .eq("project_id", projectId)
        .eq("id", taskId)
        .select()
        .maybeSingle();
      const out = check(res, "updateTask");
      return out ? toTask(out) : null;
    },

    async deleteTask(projectId, taskId) {
      if (!/^[0-9a-f-]{36}$/i.test(taskId)) return false;
      const res = await db.from("tasks").delete().eq("project_id", projectId).eq("id", taskId).select("id");
      return (check(res, "deleteTask") as any[]).length > 0;
    },

    async listTasks(projectId) {
      const res = await db.from("tasks").select("*").eq("project_id", projectId).order("created_at");
      return (check(res, "listTasks") as any[]).map(toTask);
    },

    async submitReviews(projectId, reviewerId, reviews) {
      const sub = await db.from("review_submissions").insert({ project_id: projectId, reviewer_id: reviewerId });
      if (sub.error) {
        if ((sub.error as any).code === "23505") return false; // đã nộp
        throw new Error(`[Supabase] submitReviews: ${sub.error.message}`);
      }
      const rows = reviews.map((r) => ({
        project_id: projectId,
        reviewee_id: r.revieweeId,
        responsibility: r.responsibility,
        quality: r.quality,
        collaboration: r.collaboration,
        comment: r.comment,
      }));
      const ins = await db.from("reviews").insert(rows);
      if (ins.error) {
        // hoàn tác để người dùng có thể nộp lại
        await db.from("review_submissions").delete().eq("project_id", projectId).eq("reviewer_id", reviewerId);
        throw new Error(`[Supabase] submitReviews: ${ins.error.message}`);
      }
      return true;
    },

    async listSubmitted(projectId) {
      const res = await db.from("review_submissions").select("reviewer_id").eq("project_id", projectId);
      return (check(res, "listSubmitted") as any[]).map((r) => r.reviewer_id as string);
    },

    async listReviews(projectId) {
      const res = await db.from("reviews").select("*").eq("project_id", projectId);
      return (check(res, "listReviews") as any[]).map(toReview);
    },
  };
}
