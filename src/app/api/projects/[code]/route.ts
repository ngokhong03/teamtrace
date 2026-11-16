import { getProjectOr404, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Thông tin công khai tối thiểu để hiển thị trang tham gia. */
export const GET = route(async (_req: Request, p: { code: string }) => {
  const proj = await getProjectOr404(p.code);
  return { code: proj.code, name: proj.name, course: proj.course, deadline: proj.deadline };
});
