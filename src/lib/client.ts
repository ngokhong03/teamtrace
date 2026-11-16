"use client";

export interface Session {
  memberId: string;
  token: string;
  name: string;
  /** Tên dự án + lần mở gần nhất: để trang chủ liệt kê "Dự án của bạn" */
  projectName?: string;
  lastOpenedAt?: number;
}

export interface SavedProject extends Session {
  code: string;
}

/** Danh sách nhóm đã vào trên thiết bị này, mở gần nhất xếp trước. */
export function listSessions(): SavedProject[] {
  return Object.entries(readAll())
    .map(([code, s]) => ({ code, ...s }))
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
}

/** Cập nhật tên dự án + thời điểm mở gần nhất cho phiên đã lưu. */
export function touchSession(code: string, patch: { projectName?: string }) {
  const s = readAll()[code];
  if (s) saveSession(code, { ...s, ...patch, lastOpenedAt: Date.now() });
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
