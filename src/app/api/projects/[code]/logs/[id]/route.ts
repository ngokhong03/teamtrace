import { getStore } from "@/lib/store";
import { HttpError, authenticate, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Mỗi người chỉ xoá được log của chính mình. */
export const DELETE = route(async (req: Request, p: { code: string; id: string }) => {
  const { project, member } = await authenticate(req, p.code);
  const ok = await getStore().deleteLog(project.id, p.id, member.id);
  if (!ok) throw new HttpError(404, "Không tìm thấy công việc hoặc bạn không có quyền xoá");
  return { ok: true };
});
