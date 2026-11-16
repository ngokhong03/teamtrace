import { getStore } from "@/lib/store";
import { HttpError, authenticate, readJson, route, text } from "@/lib/http";
import { LEADER_RUBRIC } from "@/lib/rubric";

export const dynamic = "force-dynamic";

/**
 * Trưởng nhóm chấm một thành viên theo bảng tiêu chí 4 mức (mẫu "Team leader's assessment").
 * Lưu đè đánh giá cũ của thành viên đó. Không chấm chính mình.
 */
export const PUT = route(async (req: Request, p: { code: string }) => {
  const { project, member } = await authenticate(req, p.code);
  if (!member.isLeader) throw new HttpError(403, "Chỉ trưởng nhóm mới chấm theo bảng tiêu chí");
  const store = getStore();
  const body = await readJson(req);

  const memberId = String(body.memberId ?? "");
  if (memberId === member.id) throw new HttpError(400, "Trưởng nhóm không tự chấm chính mình");
  const target = await store.getMember(project.id, memberId);
  if (!target) throw new HttpError(400, "Thành viên không thuộc nhóm này");

  const raw = (body.scores && typeof body.scores === "object" ? body.scores : {}) as Record<string, unknown>;
  const scores: Record<string, number> = {};
  for (const c of LEADER_RUBRIC) {
    const v = Number(raw[c.key]);
    if (!Number.isInteger(v) || v < 1 || v > 4) throw new HttpError(400, `Hãy chấm đủ tiêu chí “${c.label}” (1–4 điểm)`);
    scores[c.key] = v;
  }
  const comment = text(body.comment, "Nhận xét", { max: 1000, optional: true });

  const saved = await store.upsertAssessment({ projectId: project.id, memberId, scores, comment });
  return { assessment: saved };
});
