import type {
  AiAnalysis,
  Member,
  MemberReport,
  Project,
  RadarKey,
  ReportResponse,
  Review,
  Store,
  WorkLog,
} from "./types";
import { RADAR_KEYS } from "./types";
import {
  WEIGHTS,
  clamp,
  computeMetrics,
  computeRadar,
  computeTotal,
  heuristicAiScore,
  round1,
  type MemberMetrics,
} from "./scoring";
import { claudeAvailable, fingerprint, heuristicMemberInsight, heuristicTeam } from "./ai";

export interface ProjectData {
  project: Project;
  members: Member[];
  logs: WorkLog[];
  reviews: Review[];
  submitted: string[];
}

export async function loadProjectData(store: Store, project: Project): Promise<ProjectData> {
  const [members, logs, reviews, submitted] = await Promise.all([
    store.listMembers(project.id),
    store.listLogs(project.id),
    store.listReviews(project.id),
    store.listSubmitted(project.id),
  ]);
  return { project, members, logs, reviews, submitted };
}

export function commentsByMember(reviews: Review[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of reviews) {
    const c = r.comment.trim();
    if (!c) continue;
    (out[r.revieweeId] ??= []).push(c);
  }
  // Xáo trộn để thứ tự nhận xét không gợi ý ai viết
  for (const k of Object.keys(out)) out[k].sort(() => Math.random() - 0.5);
  return out;
}

export function dataFingerprint(d: ProjectData): string {
  return fingerprint({
    logs: d.logs,
    reviewCount: d.reviews.length,
    submittedCount: d.submitted.length,
    memberCount: d.members.length,
  });
}

/** Tính điểm nền (heuristic) cho từng thành viên – dùng chung cho report và cho prompt Claude. */
export function baseline(d: ProjectData) {
  const metrics = computeMetrics(d.project, d.members, d.logs, d.reviews);
  const comments = commentsByMember(d.reviews);
  const maxDays = Math.max(0, ...metrics.map((m) => m.activeDays));
  const heurAi: Record<string, number> = {};
  for (const m of metrics) heurAi[m.memberId] = heuristicAiScore(m, maxDays, comments[m.memberId] ?? []);
  return { metrics, comments, heurAi };
}

export function buildReport(
  d: ProjectData,
  viewerId: string,
  viewerIsLeader: boolean
): ReportResponse {
  const { project, members } = d;
  const { metrics, comments, heurAi } = baseline(d);
  const byId = new Map<string, MemberMetrics>(metrics.map((m) => [m.memberId, m]));
  const cached: AiAnalysis | null = project.analysis;
  const fp = dataFingerprint(d);
  const useClaude = cached?.source === "claude";

  // 1) điểm AI: ưu tiên kết quả Claude đã lưu, không có thì heuristic
  const aiScore = (id: string) => (useClaude && cached!.members[id] ? cached!.members[id].score : heurAi[id]);

  // 2) tổng điểm + % đóng góp
  const totals = members.map((mem) => {
    const m = byId.get(mem.id)!;
    return { id: mem.id, total: computeTotal(m.workScore, m.peerScore, aiScore(mem.id)) };
  });
  const sumTotal = totals.reduce((s, t) => s + t.total, 0);
  const share = (id: string) => {
    const t = totals.find((x) => x.id === id)!.total;
    return sumTotal > 0 ? round1((t / sumTotal) * 100) : round1(100 / members.length);
  };

  // 3) radar
  const radars = new Map(members.map((mem) => [mem.id, computeRadar(byId.get(mem.id)!)]));
  const teamRadar = {} as Record<RadarKey, number>;
  for (const k of RADAR_KEYS) {
    teamRadar[k] = round1(members.reduce((s, mem) => s + radars.get(mem.id)![k], 0) / Math.max(1, members.length));
  }

  // 4) xếp hạng
  const order = [...members].sort(
    (a, b) => totals.find((t) => t.id === b.id)!.total - totals.find((t) => t.id === a.id)!.total
  );
  const rankOf = new Map(order.map((mem, i) => [mem.id, i + 1]));

  const submittedCount = d.submitted.length;
  const others = Math.max(0, members.length - 1);

  const list: MemberReport[] = order.map((mem) => {
    const m = byId.get(mem.id)!;
    const radar = Object.fromEntries(RADAR_KEYS.map((k) => [k, round1(radars.get(mem.id)![k])])) as Record<RadarKey, number>;
    const sh = share(mem.id);
    const rank = rankOf.get(mem.id)!;
    const ai = useClaude ? cached!.members[mem.id] : undefined;
    const insight = ai
      ? { strengths: ai.strengths, improvements: ai.improvements, comment: ai.comment }
      : heuristicMemberInsight({
          name: mem.name,
          metrics: m,
          radar,
          teamRadar,
          rank,
          memberCount: members.length,
          share: sh,
        });

    const flags: string[] = [];
    if (m.logCount === 0) flags.push("Chưa ghi nhận công việc nào");
    else if (m.evidenceRate < 50) flags.push("Dưới 50% đầu việc có link minh chứng");
    if (m.unreadableLinks > 0) {
      flags.push(`${m.unreadableLinks} link minh chứng không đọc được (riêng tư hoặc lỗi)`);
    }
    if (m.peerScore !== null && m.logCount > 0 && Math.abs(m.workScore - m.peerScore) > 25) {
      flags.push(
        `Chênh lệch lớn giữa WorkTrace (${Math.round(m.workScore)}) và đánh giá đồng đội (${Math.round(m.peerScore)})`
      );
    }
    if (others > 1 && m.peer && m.peer.count < Math.ceil(others / 2)) {
      flags.push(`Mới nhận ${m.peer.count}/${others} lượt đánh giá`);
    }

    return {
      id: mem.id,
      name: mem.name,
      studentId: mem.studentId,
      isLeader: mem.isLeader,
      rank,
      total: round1(totals.find((t) => t.id === mem.id)!.total),
      share: sh,
      workScore: round1(m.workScore),
      peerScore: m.peerScore === null ? null : round1(m.peerScore),
      aiScore: round1(aiScore(mem.id)),
      radar,
      stats: {
        logCount: m.logCount,
        hours: round1(m.hours),
        effectiveHours: round1(m.effectiveHours),
        avgPercent: Math.round(m.avgPercent),
        evidenceRate: Math.round(m.evidenceRate),
        readableRate: Math.round(m.readableRate),
        activeDays: m.activeDays,
        onTimeRate: Math.round(m.onTimeRate),
        reviewCount: m.peer?.count ?? 0,
        peerAvg: m.peer
          ? {
              responsibility: round1(m.peer.responsibility),
              quality: round1(m.peer.quality),
              collaboration: round1(m.peer.collaboration),
            }
          : null,
      },
      insight,
      flags,
      // Nhận xét ẩn danh: mọi thành viên đều đọc được, không ai biết người viết
      // (hệ thống không lưu người chấm; thứ tự đã được xáo trộn)
      comments: comments[mem.id] ?? [],
    };
  });

  // 5) tóm tắt nhóm
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const shares = Object.fromEntries(list.map((x) => [x.id, x.share]));
  const heuristicTeamText = heuristicTeam({ project, metrics, names, shares });
  const team =
    useClaude && cached!.team.summary
      ? { summary: cached!.team.summary, progress: cached!.team.progress || heuristicTeamText.progress }
      : heuristicTeamText;

  const totalHours = round1(metrics.reduce((s, m) => s + m.hours, 0));
  const logCount = metrics.reduce((s, m) => s + m.logCount, 0);
  const avgPercent = totalHours
    ? Math.round(metrics.reduce((s, m) => s + m.avgPercent * m.hours, 0) / totalHours)
    : 0;

  // 6) cảnh báo cho giảng viên / nhóm
  const warnings: string[] = [];
  if (members.length < 2) warnings.push("Nhóm mới có 1 thành viên – chưa thể đánh giá chéo.");
  if (members.length >= 2 && members.length < 4)
    warnings.push("Nhóm dưới 4 người: tính ẩn danh của đánh giá chéo bị hạn chế vì dễ đoán người chấm.");
  if (members.length >= 2 && submittedCount < members.length)
    warnings.push(
      `Mới có ${submittedCount}/${members.length} thành viên nộp đánh giá chéo – điểm Peer Review chưa đầy đủ.`
    );
  if (logCount === 0) warnings.push("Chưa có công việc nào được ghi nhận trên WorkTrace.");

  return {
    project: { code: project.code, name: project.name, course: project.course, deadline: project.deadline },
    generatedAt: new Date().toISOString(),
    me: { id: viewerId, isLeader: viewerIsLeader },
    weights: WEIGHTS,
    members: list,
    teamRadar,
    team: {
      ...team,
      totalHours,
      avgPercent: clamp(avgPercent),
      logCount,
      submittedCount,
      memberCount: members.length,
    },
    warnings,
    ai: {
      source: useClaude ? "claude" : "heuristic",
      model: useClaude ? cached!.model : undefined,
      generatedAt: useClaude ? cached!.generatedAt : null,
      stale: useClaude ? cached!.fingerprint !== fp : false,
      available: claudeAvailable(),
    },
  };
}
