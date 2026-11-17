import {
  CREATIVE_CATEGORIES,
  SUPPORT_CATEGORY,
  type Member,
  type Project,
  type RadarKey,
  type Review,
  type WorkLog,
} from "./types";

/**
 * Logic tính điểm đóng góp – thuần hàm, không phụ thuộc DB, dễ kiểm thử.
 *
 * Contribution Score = 40% WorkTrace + 40% Peer Review + 20% AI
 * (nếu chưa có đánh giá chéo nào: WorkTrace 67% + AI 33%)
 */

export const WEIGHTS = { work: 0.4, peer: 0.4, ai: 0.2 };

export const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
export const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);

/** Trung bình có trọng số, bỏ qua giá trị null. */
export function blend(parts: [number | null, number][]): number {
  let s = 0;
  let w = 0;
  for (const [v, wt] of parts) {
    if (v !== null && Number.isFinite(v)) {
      s += v * wt;
      w += wt;
    }
  }
  return w ? s / w : 0;
}

export const hasLink = (l: Pick<WorkLog, "link">) => /^https?:\/\//i.test(l.link.trim());

function domainOf(link: string): string | null {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export interface PeerAgg {
  responsibility: number;
  quality: number;
  collaboration: number;
  count: number;
}

export interface MemberMetrics {
  memberId: string;
  logCount: number;
  hours: number;
  /** Khối lượng quy đổi = %hoàn thành mỗi đầu việc × (1 nếu có link minh chứng, 0.6 nếu không) */
  effectiveHours: number;
  avgPercent: number;
  evidenceRate: number; // 0-100
  /** % đầu việc có link mà hệ thống đọc được nội dung (dùng cho phần điểm AI) */
  readableRate: number; // 0-100
  /** Số link có nhưng không đọc được (riêng tư / lỗi / chưa hỗ trợ) */
  unreadableLinks: number;
  detailScore: number; // 0-100
  activeDays: number;
  onTimeRate: number; // 0-100
  domainCount: number;
  creativeShare: number; // 0-1
  supportShare: number; // 0-1
  activityScore: number; // 0-100 (so với thành viên tích cực nhất)
  workScore: number; // 0-100
  peer: PeerAgg | null;
  peerScore: number | null; // 0-100
}

/** Chuẩn hoá tên đầu việc để gom các log cùng một việc (bỏ hoa/thường, dấu cách thừa). */
const taskKey = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Gom log theo đầu việc: nhiều lần ghi nhận cùng một việc chỉ được tính tối đa 100% cho việc đó
 * (chia 1 việc thành 2 log 100% + 60% không làm tăng khối lượng). Việc có ít nhất một link mới tính đủ,
 * không có link nào thì chỉ tính 60%.
 */
export function taskUnits(mine: WorkLog[]): { units: number; tasks: number } {
  const groups = new Map<string, WorkLog[]>();
  for (const l of mine) {
    const k = taskKey(l.task);
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  let units = 0;
  for (const g of groups.values()) {
    const pct = Math.min(100, sum(g.map((l) => l.percent)));
    units += (pct / 100) * (g.some(hasLink) ? 1 : 0.6);
  }
  return { units, tasks: groups.size };
}

export function computeMetrics(
  project: Pick<Project, "deadline">,
  members: Pick<Member, "id">[],
  logs: WorkLog[],
  reviews: Review[]
): MemberMetrics[] {
  const base = members.map((m) => {
    const mine = logs.filter((l) => l.memberId === m.id);
    const n = mine.length;
    const { units: effectiveHours, tasks } = taskUnits(mine);
    const domains = new Set(mine.filter(hasLink).map((l) => domainOf(l.link)).filter(Boolean));
    return {
      memberId: m.id,
      n,
      tasks,
      hours: sum(mine.map((l) => l.hours)),
      effectiveHours,
      avgPercent: n ? mean(mine.map((l) => l.percent)) : 0,
      evidenceRate: n ? (mine.filter(hasLink).length / n) * 100 : 0,
      readableRate: n ? (mine.filter((l) => l.evidenceStatus === "ok").length / n) * 100 : 0,
      unreadableLinks: mine.filter((l) => hasLink(l) && l.evidenceStatus !== "ok" && l.evidenceStatus !== "limited").length,
      detailScore: n ? mean(mine.map((l) => Math.min(1, l.description.trim().length / 160))) * 100 : 0,
      activeDays: new Set(mine.map((l) => l.workDate)).size,
      onTimeRate: n
        ? project.deadline
          ? (mine.filter((l) => l.workDate <= project.deadline).length / n) * 100
          : 100
        : 0,
      domainCount: domains.size,
      creativeShare: n ? mine.filter((l) => CREATIVE_CATEGORIES.includes(l.category)).length / n : 0,
      supportShare: n ? mine.filter((l) => l.category === SUPPORT_CATEGORY).length / n : 0,
    };
  });

  const maxEff = Math.max(0, ...base.map((b) => b.effectiveHours));
  const maxN = Math.max(0, ...base.map((b) => b.tasks));
  const maxDays = Math.max(0, ...base.map((b) => b.activeDays));

  return base.map((b) => {
    const volume = maxEff > 0 ? (b.effectiveHours / maxEff) * 100 : 0;
    const activityScore =
      maxN > 0 && maxDays > 0 ? (0.5 * (b.tasks / maxN) + 0.5 * (b.activeDays / maxDays)) * 100 : 0;
    const workScore = b.n === 0 ? 0 : 0.55 * volume + 0.25 * b.evidenceRate + 0.2 * b.detailScore;

    const got = reviews.filter((r) => r.revieweeId === b.memberId);
    const peer: PeerAgg | null = got.length
      ? {
          responsibility: mean(got.map((r) => r.responsibility)),
          quality: mean(got.map((r) => r.quality)),
          collaboration: mean(got.map((r) => r.collaboration)),
          count: got.length,
        }
      : null;
    const peerScore = peer ? ((peer.responsibility + peer.quality + peer.collaboration) / 15) * 100 : null;

    return {
      memberId: b.memberId,
      logCount: b.n,
      hours: b.hours,
      effectiveHours: b.effectiveHours,
      avgPercent: b.avgPercent,
      evidenceRate: b.evidenceRate,
      readableRate: b.readableRate,
      unreadableLinks: b.unreadableLinks,
      detailScore: b.detailScore,
      activeDays: b.activeDays,
      onTimeRate: b.onTimeRate,
      domainCount: b.domainCount,
      creativeShare: b.creativeShare,
      supportShare: b.supportShare,
      activityScore,
      workScore: clamp(workScore),
      peer,
      peerScore,
    };
  });
}

/* ---------- Heuristic "AI" score (20%) – dùng khi chưa gọi Claude ---------- */

const POSITIVE = ["tốt", "nhiệt tình", "chủ động", "giỏi", "trách nhiệm", "hỗ trợ", "sáng tạo", "đúng hạn", "cảm ơn", "chăm chỉ", "đáng tin"];
const NEGATIVE = ["trễ", "chậm", "không làm", "thiếu", "lười", "bỏ", "vắng", "khó liên lạc", "cẩu thả", "qua loa", "muộn", "ít tham gia"];

export function sentimentScore(comments: string[]): number | null {
  if (!comments.length) return null;
  let pos = 0;
  let neg = 0;
  for (const c of comments) {
    const t = c.toLowerCase();
    pos += POSITIVE.filter((w) => t.includes(w)).length;
    neg += NEGATIVE.filter((w) => t.includes(w)).length;
  }
  if (pos + neg === 0) return null;
  return 50 + (50 * (pos - neg)) / (pos + neg);
}

export function heuristicAiScore(m: MemberMetrics, maxDays: number, comments: string[]): number {
  if (m.logCount === 0) return 0;
  const consistency = maxDays > 0 ? (m.activeDays / maxDays) * 100 : 0;
  const quality = m.peer ? (m.peer.quality / 5) * 100 : m.evidenceRate;
  return clamp(
    blend([
      [m.detailScore, 0.25],
      [consistency, 0.2],
      [quality, 0.25],
      // Minh chứng mà hệ thống mở và đọc được nội dung thật
      [m.readableRate, 0.2],
      [sentimentScore(comments), 0.1],
    ])
  );
}

/* ---------- Radar 5 trục ---------- */

export function computeRadar(m: MemberMetrics): Record<RadarKey, number> {
  const p = m.peer;
  const pr = p ? (p.responsibility / 5) * 100 : null;
  const pq = p ? (p.quality / 5) * 100 : null;
  const pc = p ? (p.collaboration / 5) * 100 : null;
  const hasWork = m.logCount > 0;
  const diversity = Math.min(1, m.domainCount / 3) * 100;

  return {
    initiative: clamp(blend([[hasWork ? m.activityScore : 0, 0.6], [pr, 0.4]])),
    depth: clamp(blend([[hasWork ? m.detailScore : 0, 0.5], [pq, 0.5], [pq === null ? m.evidenceRate : null, 0.3]])),
    punctuality: clamp(
      blend([[hasWork ? 0.6 * m.onTimeRate + 0.4 * m.avgPercent : 0, 0.5], [pr, 0.5]])
    ),
    creativity: clamp(
      blend([[pq, 0.5], [hasWork ? diversity : 0, 0.3], [Math.min(1, m.creativeShare * 2) * 100, 0.2]])
    ),
    support: clamp(blend([[pc, 0.7], [Math.min(1, m.supportShare * 3) * 100, 0.3]])),
  };
}

/**
 * Điều chỉnh điểm Peer theo mức minh chứng công việc.
 * Đồng đội có thể chấm cao vì nể nang; nếu người đó gần như không có minh chứng trên WorkTrace
 * thì điểm Peer chỉ được tính tối đa 20%. Từ WorkTrace >= 60 điểm trở lên được tính đủ 100%.
 */
export function peerEvidenceFactor(workScore: number): number {
  return 0.2 + 0.8 * Math.min(1, workScore / 60);
}

export function computeTotal(workScore: number, peerScore: number | null, aiScore: number): number {
  if (peerScore === null) {
    const w = WEIGHTS.work + WEIGHTS.ai;
    return clamp((workScore * WEIGHTS.work + aiScore * WEIGHTS.ai) / w);
  }
  const peerAdj = peerScore * peerEvidenceFactor(workScore);
  return clamp(workScore * WEIGHTS.work + peerAdj * WEIGHTS.peer + aiScore * WEIGHTS.ai);
}

/** Điểm cá nhân đề xuất từ điểm nhóm (tham khảo cho giảng viên). */
export function suggestGrade(groupGrade: number, sharePct: number, memberCount: number): number {
  const ratio = clamp((sharePct / 100) * memberCount, 0.5, 1.15);
  return Math.min(10, round1(groupGrade * ratio));
}
