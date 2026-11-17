import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import type { Activity, AiAnalysis, EvidenceStatus, LeaderAssessment, Member, Project, Review, Store, Task, TaskNote, WorkLog } from "@/lib/types";

/** Các cột của work_logs trừ toàn văn minh chứng (để danh sách nhẹ) */
const LOG_COLS =
  "id,project_id,member_id,task,description,link,category,hours,percent,work_date,created_at,evidence_status,evidence_title,evidence_excerpt";
const excerpt = (t: string) => t.slice(0, 300);

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
  evidenceStatus: (r.evidence_status ?? (r.link ? "error" : "none")) as EvidenceStatus,
  evidenceTitle: r.evidence_title ?? "",
  evidenceExcerpt: r.evidence_excerpt ?? "",
});

const toNote = (r: any): TaskNote => ({
  id: r.id,
  projectId: r.project_id,
  taskId: r.task_id,
  memberId: r.member_id,
  content: r.content,
  createdAt: r.created_at,
});

const toActivity = (r: any): Activity => ({
  id: r.id,
  projectId: r.project_id,
  actorId: r.actor_id ?? null,
  type: r.type,
  taskId: r.task_id ?? null,
  logId: r.log_id ?? null,
  summary: r.summary ?? "",
  detail: r.detail ?? {},
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
  dueTime: r.due_time ?? "",
  status: r.status,
  createdAt: r.created_at,
  doneAt: r.done_at ?? null,
  requirements: Array.isArray(r.requirements) ? r.requirements : [],
  supporterIds: Array.isArray(r.supporter_ids) ? r.supporter_ids : [],
  productLink: r.product_link ?? "",
  approval: r.approval ?? "none",
  approvedAt: r.approved_at ?? null,
});

const toAssessment = (r: any): LeaderAssessment => ({
  projectId: r.project_id,
  memberId: r.member_id,
  scores: r.scores ?? {},
  comment: r.comment ?? "",
  updatedAt: r.updated_at,
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

    async addLog(input, evidenceText) {
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
          evidence_status: input.evidenceStatus,
          evidence_title: input.evidenceTitle,
          evidence_excerpt: excerpt(evidenceText),
          evidence_text: evidenceText,
        })
        .select(LOG_COLS)
        .single();
      return toLog(check(res, "addLog"));
    },

    async getLog(projectId, logId) {
      if (!/^[0-9a-f-]{36}$/i.test(logId)) return null;
      const res = await db.from("work_logs").select("*").eq("project_id", projectId).eq("id", logId).maybeSingle();
      const row = check(res, "getLog") as any;
      return row ? { ...toLog(row), evidenceText: row.evidence_text ?? "" } : null;
    },

    async updateLogEvidence(projectId, logId, ev) {
      const res = await db
        .from("work_logs")
        .update({
          evidence_status: ev.status,
          evidence_title: ev.title,
          evidence_excerpt: excerpt(ev.text),
          evidence_text: ev.text,
        })
        .eq("project_id", projectId)
        .eq("id", logId);
      check({ data: true, error: res.error }, "updateLogEvidence");
    },

    async listEvidenceTexts(projectId) {
      const res = await db
        .from("work_logs")
        .select("id,evidence_text")
        .eq("project_id", projectId)
        .neq("evidence_text", "");
      return (check(res, "listEvidenceTexts") as any[]).map((r) => ({ logId: r.id, text: r.evidence_text as string }));
    },

    async addNote(projectId, input) {
      const res = await db
        .from("task_notes")
        .insert({ project_id: projectId, task_id: input.taskId, member_id: input.memberId, content: input.content })
        .select()
        .single();
      return toNote(check(res, "addNote"));
    },

    async listNotes(projectId) {
      const res = await db.from("task_notes").select("*").eq("project_id", projectId).order("created_at");
      return (check(res, "listNotes") as any[]).map(toNote);
    },

    async addActivity(input) {
      const res = await db.from("activities").insert({
        project_id: input.projectId,
        actor_id: input.actorId,
        type: input.type,
        task_id: input.taskId,
        log_id: input.logId,
        summary: input.summary,
        detail: input.detail,
      });
      check({ data: true, error: res.error }, "addActivity");
    },

    async listActivities(projectId, limit) {
      const res = await db
        .from("activities")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (check(res, "listActivities") as any[]).map(toActivity);
    },

    async updateLog(projectId, logId, patch, ev) {
      const row: Record<string, unknown> = {};
      if (patch.task !== undefined) row.task = patch.task;
      if (patch.description !== undefined) row.description = patch.description;
      if (patch.link !== undefined) row.link = patch.link;
      if (patch.category !== undefined) row.category = patch.category;
      if (patch.percent !== undefined) row.percent = patch.percent;
      if (patch.workDate !== undefined) row.work_date = patch.workDate;
      if (ev) {
        row.evidence_status = ev.status;
        row.evidence_title = ev.title;
        row.evidence_excerpt = excerpt(ev.text);
        row.evidence_text = ev.text;
      }
      if (!Object.keys(row).length) return;
      const res = await db.from("work_logs").update(row).eq("project_id", projectId).eq("id", logId);
      check({ data: true, error: res.error }, "updateLog");
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
        .select(LOG_COLS)
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
          due_time: input.dueTime,
          requirements: input.requirements,
          supporter_ids: input.supporterIds,
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
      if (patch.dueTime !== undefined) row.due_time = patch.dueTime;
      if (patch.requirements !== undefined) row.requirements = patch.requirements;
      if (patch.supporterIds !== undefined) row.supporter_ids = patch.supporterIds;
      if (patch.productLink !== undefined) row.product_link = patch.productLink;
      if (patch.approval !== undefined) {
        row.approval = patch.approval;
        row.approved_at = patch.approval === "approved" ? new Date().toISOString() : null;
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

    async upsertAssessment(a) {
      const res = await db
        .from("leader_assessments")
        .upsert(
          { project_id: a.projectId, member_id: a.memberId, scores: a.scores, comment: a.comment, updated_at: new Date().toISOString() },
          { onConflict: "project_id,member_id" }
        )
        .select()
        .single();
      return toAssessment(check(res, "upsertAssessment"));
    },

    async listAssessments(projectId) {
      const res = await db.from("leader_assessments").select("*").eq("project_id", projectId);
      return (check(res, "listAssessments") as any[]).map(toAssessment);
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
