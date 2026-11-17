export const CATEGORIES = [
  "Nghiên cứu",
  "Viết nội dung",
  "Thiết kế",
  "Ý tưởng & Sáng tạo",
  "Thuyết trình",
  "Hỗ trợ & Điều phối",
  "Khác",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CREATIVE_CATEGORIES: string[] = ["Thiết kế", "Ý tưởng & Sáng tạo"];
export const SUPPORT_CATEGORY = "Hỗ trợ & Điều phối";

/* ---------- Data model (DB) ---------- */

export interface Project {
  id: string;
  code: string;
  name: string;
  course: string;
  deadline: string; // yyyy-mm-dd hoặc ""
  createdAt: string;
  analysis: AiAnalysis | null;
}

export interface Member {
  id: string;
  projectId: string;
  name: string;
  studentId: string;
  token: string;
  isLeader: boolean;
  joinedAt: string;
  /** "salt:hash" (scrypt). null = tài khoản cũ chưa có PIN, sẽ được đặt PIN ở lần vào lại. */
  pinHash: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
}

export interface MemberPatch {
  pinHash?: string;
  failedAttempts?: number;
  lockedUntil?: string | null;
}

export interface WorkLog {
  id: string;
  projectId: string;
  memberId: string;
  task: string;
  description: string;
  link: string;
  category: string;
  hours: number;
  percent: number;
  workDate: string; // yyyy-mm-dd
  createdAt: string;
  /** Kết quả đọc link minh chứng (xem lib/evidence.ts) */
  evidenceStatus: EvidenceStatus;
  evidenceTitle: string;
  /** ~300 ký tự đầu nội dung đọc được (toàn văn chỉ lấy qua API chi tiết) */
  evidenceExcerpt: string;
}

export const EVIDENCE_STATUSES = ["none", "ok", "limited", "private", "unsupported", "error"] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export const EVIDENCE_LABELS: Record<EvidenceStatus, string> = {
  none: "Không có link",
  ok: "AI đã đọc được nội dung",
  limited: "Chỉ đọc được tiêu đề",
  private: "Link đang để riêng tư",
  unsupported: "Loại link chưa đọc được",
  error: "Không mở được link",
};
export interface Evidence {
  status: EvidenceStatus;
  title: string;
  text: string;
}

/** Ghi chú của thành viên vào một nhiệm vụ. */
export interface TaskNote {
  id: string;
  projectId: string;
  taskId: string;
  memberId: string;
  content: string;
  createdAt: string;
}

export const ACTIVITY_TYPES = [
  "member_joined",
  "task_assigned",
  "task_status",
  "task_note",
  "task_deleted",
  "log_added",
  "log_deleted",
  "evidence_rechecked",
  "task_review",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Lịch sử hoạt động – chỉ thêm, không sửa/xoá (kể cả khi công việc bị xoá). */
export interface Activity {
  id: string;
  projectId: string;
  actorId: string | null;
  type: ActivityType;
  taskId: string | null;
  logId: string | null;
  summary: string;
  detail: Record<string, unknown>;
  createdAt: string;
}
export type NewActivity = Omit<Activity, "id" | "createdAt">;

export const TASK_STATUSES = ["todo", "doing", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "Chưa làm",
  doing: "Đang làm",
  done: "Hoàn thành",
};

/** Nhiệm vụ được giao cho một thành viên. */
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  assigneeId: string;
  createdBy: string;
  dueDate: string; // yyyy-mm-dd hoặc ""
  /** Giờ hạn nộp "HH:MM" (theo mẫu Progress Tracker, ví dụ 23:00) hoặc "" */
  dueTime: string;
  status: TaskStatus;
  createdAt: string;
  doneAt: string | null;
  /** Danh sách yêu cầu đánh số (cột Requirements) */
  requirements: string[];
  /** Người hỗ trợ (cột Supporter) */
  supporterIds: string[];
  /** Link sản phẩm người phụ trách nộp khi hoàn thành */
  productLink: string;
  /** Trưởng nhóm duyệt: none = chưa duyệt, approved = Completed & Approved, revise = yêu cầu sửa */
  approval: TaskApproval;
  approvedAt: string | null;
}
export type TaskApproval = "none" | "approved" | "revise";
export interface LogPatch {
  task?: string;
  description?: string;
  link?: string;
  category?: string;
  percent?: number;
  workDate?: string;
}
export type NewTask = Pick<
  Task,
  "title" | "description" | "assigneeId" | "createdBy" | "dueDate" | "dueTime" | "requirements" | "supporterIds"
>;
export interface TaskPatch {
  title?: string;
  description?: string;
  assigneeId?: string;
  dueDate?: string;
  dueTime?: string;
  status?: TaskStatus;
  requirements?: string[];
  supporterIds?: string[];
  productLink?: string;
  approval?: TaskApproval;
}

/** Đánh giá của trưởng nhóm theo bảng tiêu chí 4 mức (mẫu "Team leader's assessment"). */
export interface LeaderAssessment {
  projectId: string;
  memberId: string;
  /** khoá tiêu chí -> điểm 1..4 */
  scores: Record<string, number>;
  comment: string;
  updatedAt: string;
}

/** Đánh giá chéo – KHÔNG có trường người chấm (ẩn danh ở tầng dữ liệu). */
export interface Review {
  id: string;
  projectId: string;
  revieweeId: string;
  responsibility: number;
  quality: number;
  collaboration: number;
  comment: string;
}
export type NewReview = Omit<Review, "id" | "projectId">;

export interface AiMemberInsight {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  comment: string;
}

export interface AiAnalysis {
  source: "claude" | "heuristic";
  model?: string;
  generatedAt: string;
  fingerprint: string;
  team: { summary: string; progress: string };
  members: Record<string, AiMemberInsight>;
}

export interface Store {
  createProject(input: { code: string; name: string; course: string; deadline: string }): Promise<Project>;
  getProjectByCode(code: string): Promise<Project | null>;
  setAnalysis(projectId: string, analysis: AiAnalysis): Promise<void>;

  addMember(
    projectId: string,
    input: { name: string; studentId: string; isLeader: boolean; pinHash: string }
  ): Promise<Member>;
  updateMember(projectId: string, memberId: string, patch: MemberPatch): Promise<void>;
  getMember(projectId: string, memberId: string): Promise<Member | null>;
  findMemberByStudentId(projectId: string, studentId: string): Promise<Member | null>;
  listMembers(projectId: string): Promise<Member[]>;

  addLog(input: Omit<WorkLog, "id" | "createdAt" | "evidenceExcerpt">, evidenceText: string): Promise<WorkLog>;
  getLog(projectId: string, logId: string): Promise<(WorkLog & { evidenceText: string }) | null>;
  updateLogEvidence(projectId: string, logId: string, ev: Evidence): Promise<void>;
  deleteLog(projectId: string, logId: string, memberId: string): Promise<boolean>;
  updateLog(projectId: string, logId: string, patch: LogPatch, ev?: Evidence): Promise<void>;
  listLogs(projectId: string): Promise<WorkLog[]>;
  /** Toàn văn nội dung minh chứng đọc được (cho AI) */
  listEvidenceTexts(projectId: string): Promise<{ logId: string; text: string }[]>;

  addNote(projectId: string, input: { taskId: string; memberId: string; content: string }): Promise<TaskNote>;
  listNotes(projectId: string): Promise<TaskNote[]>;

  addActivity(input: NewActivity): Promise<void>;
  listActivities(projectId: string, limit: number): Promise<Activity[]>;

  addTask(projectId: string, input: NewTask): Promise<Task>;
  getTask(projectId: string, taskId: string): Promise<Task | null>;
  updateTask(projectId: string, taskId: string, patch: TaskPatch): Promise<Task | null>;
  deleteTask(projectId: string, taskId: string): Promise<boolean>;
  listTasks(projectId: string): Promise<Task[]>;

  upsertAssessment(a: Omit<LeaderAssessment, "updatedAt">): Promise<LeaderAssessment>;
  listAssessments(projectId: string): Promise<LeaderAssessment[]>;

  /** false nếu người này đã nộp đánh giá trước đó */
  submitReviews(projectId: string, reviewerId: string, reviews: NewReview[]): Promise<boolean>;
  listSubmitted(projectId: string): Promise<string[]>;
  listReviews(projectId: string): Promise<Review[]>;
}

/* ---------- API response shapes (dùng chung server + client) ---------- */

export interface PublicMember {
  id: string;
  name: string;
  studentId: string;
  isLeader: boolean;
}

export interface StateResponse {
  project: { code: string; name: string; course: string; deadline: string; createdAt: string };
  me: { id: string; name: string; studentId: string; isLeader: boolean; submitted: boolean };
  members: PublicMember[];
  /** Chỉ con số tổng – không lộ ai đã/chưa nộp đánh giá */
  submittedCount: number;
  logs: WorkLog[];
  tasks: Task[];
  notes: TaskNote[];
  /** Hoạt động gần đây (thành viên thường không thấy sự kiện xoá công việc) */
  activities: Activity[];
  /** Trưởng nhóm thấy tất cả; thành viên chỉ thấy đánh giá về chính mình */
  assessments: LeaderAssessment[];
}

export const RADAR_KEYS = ["initiative", "depth", "punctuality", "creativity", "support"] as const;
export type RadarKey = (typeof RADAR_KEYS)[number];
export const RADAR_LABELS: Record<RadarKey, string> = {
  initiative: "Chủ động",
  depth: "Chiều sâu",
  punctuality: "Đúng hạn",
  creativity: "Sáng tạo",
  support: "Hỗ trợ đồng đội",
};

export interface MemberReport {
  id: string;
  name: string;
  studentId: string;
  isLeader: boolean;
  rank: number;
  total: number; // Contribution Score 0-100
  share: number; // % đóng góp đề xuất
  workScore: number;
  peerScore: number | null;
  aiScore: number;
  radar: Record<RadarKey, number>;
  stats: {
    logCount: number;
    hours: number;
    effectiveHours: number;
    avgPercent: number;
    evidenceRate: number; // 0-100
    readableRate: number; // 0-100: % đầu việc AI đọc được nội dung link
    activeDays: number;
    onTimeRate: number; // 0-100
    reviewCount: number;
    peerAvg: { responsibility: number; quality: number; collaboration: number } | null;
  };
  insight: { strengths: string[]; improvements: string[]; comment: string };
  flags: string[];
  /** Nhận xét ẩn danh về người này – mọi thành viên đều xem được, không kèm người viết */
  comments: string[];
  /** Đánh giá của trưởng nhóm (chỉ trả cho trưởng nhóm và chính người được đánh giá) */
  leaderAssessment: { average: number; scores: Record<string, number>; comment: string } | null;
}

export interface ReportResponse {
  project: { code: string; name: string; course: string; deadline: string };
  generatedAt: string;
  me: { id: string; isLeader: boolean };
  weights: { work: number; peer: number; ai: number };
  members: MemberReport[]; // đã sắp xếp theo rank
  teamRadar: Record<RadarKey, number>;
  team: {
    summary: string;
    progress: string;
    totalHours: number;
    avgPercent: number;
    logCount: number;
    submittedCount: number;
    memberCount: number;
  };
  warnings: string[];
  ai: { source: "claude" | "heuristic"; model?: string; generatedAt: string | null; stale: boolean; available: boolean };
}
