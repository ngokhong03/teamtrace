import { NextResponse } from "next/server";
import { getStore } from "./store";
import type { Member, Project } from "./types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Bọc route handler: chờ params (Next.js 15 truyền params dạng Promise), bắt lỗi và trả JSON thống nhất.
 * Hàm bên trong nhận params đã giải sẵn, ví dụ route(async (req, p: { code: string }) => ...).
 */
export function route<P extends Record<string, string> = Record<string, never>>(
  fn: (req: Request, params: P) => Promise<unknown>
) {
  return async (req: Request, ctx: { params: Promise<P> }) => {
    try {
      const params = ((await ctx?.params) ?? {}) as P;
      const data = await fn(req, params);
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error(e);
      const msg = e instanceof Error ? e.message : "Lỗi máy chủ";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === "object") return body as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  throw new HttpError(400, "Dữ liệu gửi lên không hợp lệ");
}

export function normCode(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, 6);
}

export async function getProjectOr404(rawCode: string): Promise<Project> {
  const code = normCode(rawCode);
  const project = code.length === 6 ? await getStore().getProjectByCode(code) : null;
  if (!project) throw new HttpError(404, "Không tìm thấy dự án với mã này");
  return project;
}

export async function authenticate(req: Request, rawCode: string): Promise<{ project: Project; member: Member }> {
  const project = await getProjectOr404(rawCode);
  const memberId = req.headers.get("x-member-id") ?? "";
  const token = req.headers.get("x-member-token") ?? "";
  const member = memberId ? await getStore().getMember(project.id, memberId) : null;
  if (!member || !token || member.token !== token) {
    throw new HttpError(401, "Phiên đăng nhập không hợp lệ, vui lòng tham gia lại bằng Tên + Mã sinh viên");
  }
  return { project, member };
}

/* ---------- validators ---------- */

export function str(v: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  if (!s && opts.optional) return "";
  if (s.length < (opts.min ?? 1)) throw new HttpError(400, `${field} chưa hợp lệ`);
  if (s.length > opts.max) throw new HttpError(400, `${field} quá dài (tối đa ${opts.max} ký tự)`);
  return s;
}

/** Giống str nhưng giữ nguyên xuống dòng (cho ô mô tả / nhận xét). */
export function text(v: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && opts.optional) return "";
  if (s.length < (opts.min ?? 1)) throw new HttpError(400, `${field} quá ngắn (tối thiểu ${opts.min ?? 1} ký tự)`);
  if (s.length > opts.max) throw new HttpError(400, `${field} quá dài (tối đa ${opts.max} ký tự)`);
  return s;
}

export function int(v: unknown, field: string, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${field} phải từ ${min} đến ${max}`);
  return Math.round(n);
}

export function isoDate(v: unknown, field: string, optional = false): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s && optional) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
    throw new HttpError(400, `${field} không hợp lệ (định dạng yyyy-mm-dd)`);
  }
  return s;
}
