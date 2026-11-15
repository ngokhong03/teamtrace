import { getStore } from "@/lib/store";
import { HttpError, authenticate, int, readJson, route, text } from "@/lib/http";
import type { NewReview } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Nộp đánh giá chéo (1 lần duy nhất cho mỗi thành viên).
 * Nội dung đánh giá được lưu KHÔNG kèm người chấm; chỉ ghi nhận "người này đã nộp".
 */
export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const { project, member } = await authenticate(req, ctx.params.code);
  const store = getStore();
  const body = await readJson(req);

  const members = await store.listMembers(project.id);
  const targets = members.filter((m) => m.id !== member.id);
  if (targets.length === 0) throw new HttpError(400, "Nhóm chưa có thành viên nào khác để đánh giá");

  const raw = Array.isArray(body.reviews) ? (body.reviews as Record<string, unknown>[]) : [];
  const parsed: NewReview[] = raw.map((r) => ({
    revieweeId: String(r?.revieweeId ?? ""),
    responsibility: int(r?.responsibility, "Điểm trách nhiệm", 1, 5),
    quality: int(r?.quality, "Điểm chất lượng", 1, 5),
    collaboration: int(r?.collaboration, "Điểm phối hợp", 1, 5),
    comment: text(r?.comment, "Nhận xét", { max: 800, optional: true }),
  }));

  const ids = new Set(parsed.map((p) => p.revieweeId));
  const valid =
    parsed.length === targets.length && ids.size === targets.length && targets.every((t) => ids.has(t.id));
  if (!valid) {
    throw new HttpError(400, "Bạn cần đánh giá đủ tất cả thành viên khác trong nhóm (không đánh giá chính mình)");
  }

  const ok = await store.submitReviews(project.id, member.id, parsed);
  if (!ok) throw new HttpError(409, "Bạn đã nộp đánh giá rồi, không thể nộp lại");
  return { ok: true };
});
