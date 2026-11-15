import { getStore } from "@/lib/store";
import { HttpError, authenticate, route } from "@/lib/http";
import { baseline, dataFingerprint, loadProjectData } from "@/lib/report";
import { claudeAvailable, runClaude } from "@/lib/ai";
import type { AiAnalysis } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Claude có thể mất vài chục giây

/** Chạy phân tích bằng Claude và lưu kết quả. Chỉ trưởng nhóm được gọi; tối đa 1 lần / 60 giây. */
export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const { project, member } = await authenticate(req, ctx.params.code);
  if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới được chạy phân tích AI");
  if (!claudeAvailable()) throw new HttpError(400, "Chưa cấu hình ANTHROPIC_API_KEY – đang dùng phân tích heuristic có sẵn");

  if (project.analysis?.source === "claude") {
    const age = Date.now() - Date.parse(project.analysis.generatedAt);
    if (age < 60_000) throw new HttpError(429, "Vui lòng đợi ít phút trước khi chạy lại phân tích");
  }

  const store = getStore();
  const data = await loadProjectData(store, project);
  const { metrics, comments, heurAi } = baseline(data);

  let result;
  try {
    result = await runClaude({
      project,
      members: data.members.map((m) => ({
        id: m.id,
        name: m.name,
        metrics: metrics.find((x) => x.memberId === m.id)!,
        logs: data.logs.filter((l) => l.memberId === m.id),
        comments: comments[m.id] ?? [],
        baseline: heurAi[m.id],
      })),
    });
  } catch (e) {
    console.error(e);
    throw new HttpError(502, "Không gọi được Claude: " + (e instanceof Error ? e.message : "lỗi không xác định"));
  }

  const analysis: AiAnalysis = {
    source: "claude",
    model: result.model,
    generatedAt: new Date().toISOString(),
    fingerprint: dataFingerprint(data),
    team: result.team,
    members: result.members,
  };
  await store.setAnalysis(project.id, analysis);
  return { ok: true, analyzed: Object.keys(result.members).length };
});
