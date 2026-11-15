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

  addLog(input: Omit<WorkLog, "id" | "createdAt">): Promise<WorkLog>;
  deleteLog(projectId: string, logId: string, memberId: string): Promise<boolean>;
  listLogs(projectId: string): Promise<WorkLog[]>;

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
  submitted: boolean;
}

export interface StateResponse {
  project: { code: string; name: string; course: string; deadline: string; createdAt: string };
  me: { id: string; name: string; studentId: string; isLeader: boolean; submitted: boolean };
  members: PublicMember[];
  logs: WorkLog[];
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
    activeDays: number;
    onTimeRate: number; // 0-100
    reviewCount: number;
    peerAvg: { responsibility: number; quality: number; collaboration: number } | null;
  };
  insight: { strengths: string[]; improvements: string[]; comment: string };
  flags: string[];
  /** Nhận xét ẩn danh nhận được – chỉ trả về cho chính người đó */
  comments: string[] | null;
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
