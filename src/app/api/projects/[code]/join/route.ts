import { getStore } from "@/lib/store";
import { HttpError, getProjectOr404, readJson, route, str } from "@/lib/http";
import { LOCK_MINUTES, MAX_ATTEMPTS, hashPin, parsePin, verifyPin } from "@/lib/pin";

export const dynamic = "force-dynamic";

const MAX_MEMBERS = 12;

/**
 * Tham gia bằng Tên + Mã sinh viên + PIN.
 * - MSSV chưa có trong nhóm  -> tạo thành viên mới với PIN vừa đặt.
 * - MSSV đã có               -> phải nhập đúng PIN (sai 5 lần liên tiếp -> khoá 10 phút).
 */
export const POST = route(async (req: Request, ctx: { params: { code: string } }) => {
  const project = await getProjectOr404(ctx.params.code);
  const body = await readJson(req);
  const name = str(body.name, "Họ tên", { min: 2, max: 60 });
  const studentId = str(body.studentId, "Mã sinh viên", { min: 3, max: 30 });
  const pin = parsePin(body.pin);

  const store = getStore();
  const existing = await store.findMemberByStudentId(project.id, studentId);

  if (existing) {
    if (existing.lockedUntil && Date.parse(existing.lockedUntil) > Date.now()) {
      const mins = Math.ceil((Date.parse(existing.lockedUntil) - Date.now()) / 60_000);
      throw new HttpError(429, `Nhập sai PIN quá nhiều lần. Vui lòng thử lại sau ${mins} phút.`);
    }

    // Tài khoản tạo trước khi có PIN: nhận PIN đầu tiên làm PIN chính thức.
    if (!existing.pinHash) {
      await store.updateMember(project.id, existing.id, {
        pinHash: hashPin(pin),
        failedAttempts: 0,
        lockedUntil: null,
      });
      return { memberId: existing.id, token: existing.token, name: existing.name, rejoined: true };
    }

    if (!verifyPin(pin, existing.pinHash)) {
      const attempts = existing.failedAttempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await store.updateMember(project.id, existing.id, {
          failedAttempts: 0,
          lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(),
        });
        throw new HttpError(429, `Nhập sai PIN ${MAX_ATTEMPTS} lần. Tài khoản bị khoá ${LOCK_MINUTES} phút.`);
      }
      await store.updateMember(project.id, existing.id, { failedAttempts: attempts });
      throw new HttpError(401, `PIN không đúng (còn ${MAX_ATTEMPTS - attempts} lần thử).`);
    }

    if (existing.failedAttempts > 0 || existing.lockedUntil) {
      await store.updateMember(project.id, existing.id, { failedAttempts: 0, lockedUntil: null });
    }
    return { memberId: existing.id, token: existing.token, name: existing.name, rejoined: true };
  }

  const members = await store.listMembers(project.id);
  if (members.length >= MAX_MEMBERS) {
    throw new HttpError(400, `Nhóm đã đủ ${MAX_MEMBERS} thành viên`);
  }
  const m = await store.addMember(project.id, { name, studentId, isLeader: false, pinHash: hashPin(pin) });
  return { memberId: m.id, token: m.token, name: m.name, rejoined: false };
});
