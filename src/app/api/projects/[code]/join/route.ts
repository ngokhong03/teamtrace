import { getStore } from "@/lib/store";
import { HttpError, getProjectOr404, readJson, route, str } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_MEMBERS = 12;

/** Tham gia bằng Tên + Mã sinh viên. Nếu MSSV đã có trong nhóm -> vào lại tài khoản đó. */
export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const project = await getProjectOr404(ctx.params.code);
  const body = await readJson(req);
  const name = str(body.name, "Họ tên", { min: 2, max: 60 });
  const studentId = str(body.studentId, "Mã sinh viên", { min: 3, max: 30 });

  const store = getStore();
  const existing = await store.findMemberByStudentId(project.id, studentId);
  if (existing) {
    return { memberId: existing.id, token: existing.token, name: existing.name, rejoined: true };
  }

  const members = await store.listMembers(project.id);
  if (members.length >= MAX_MEMBERS) {
    throw new HttpError(400, `Nhóm đã đủ ${MAX_MEMBERS} thành viên`);
  }
  const m = await store.addMember(project.id, { name, studentId, isLeader: false });
  return { memberId: m.id, token: m.token, name: m.name, rejoined: false };
});
