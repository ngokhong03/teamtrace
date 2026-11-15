"use client";

export interface Session {
  memberId: string;
  token: string;
  name: string;
}

const KEY = "teamtrace.sessions.v1";

function readAll(): Record<string, Session> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

export function getSession(code: string): Session | null {
  return readAll()[code] ?? null;
}

export function saveSession(code: string, s: Session) {
  try {
    const all = readAll();
    all[code] = s;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* localStorage bị chặn – phiên chỉ sống trong tab hiện tại */
  }
}

export function clearSession(code: string) {
  try {
    const all = readAll();
    delete all[code];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown; session?: Session | null } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.session) {
    headers["x-member-id"] = opts.session.memberId;
    headers["x-member-token"] = opts.session.token;
  }
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra mạng và thử lại.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error || `Lỗi ${res.status}`);
  return data as T;
}
