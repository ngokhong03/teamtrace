import { getProjectOr404, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Thông tin công khai tối thiểu để hiển thị trang tham gia. */
export const GET = route(async (_req: Request, ctx: { params: { code: string } }) => {
  const p = await getProjectOr404(ctx.params.code);
  return { code: p.code, name: p.name, course: p.course, deadline: p.deadline };
});
