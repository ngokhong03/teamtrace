import { lookup } from "dns/promises";
import { isIP } from "net";
import type { Evidence } from "./types";

/**
 * Đọc nội dung link minh chứng để AI chấm điểm.
 *
 * An toàn (chống SSRF – lợi dụng máy chủ truy cập mạng nội bộ):
 * - Chỉ http/https, cổng mặc định; chặn localhost và mọi dải IP nội bộ/đặc biệt (kiểm tra sau khi phân giải DNS).
 * - Tự theo tối đa 3 lần chuyển hướng, kiểm tra lại từng đích.
 * - Giới hạn 7 giây và 1,5 MB; chỉ đọc nội dung dạng chữ.
 *
 * Hỗ trợ đọc toàn văn: Google Docs / Slides / Sheets (khi bật "Bất kỳ ai có đường liên kết"),
 * GitHub (README của repo, file trong repo), trang web thường, file .txt/.md/.csv/.json.
 * Canva, Figma, Google Drive (file PDF/ảnh)… chỉ đọc được tiêu đề hoặc chưa hỗ trợ.
 */

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 8000;
const TIMEOUT_MS = 7000;
const UA = "Mozilla/5.0 (compatible; TeamTraceEvidenceBot/1.0; +https://teamtrace-pi.vercel.app)";

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipPrivate(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Private(ip);
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

async function assertPublicUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("blocked");
  if (u.port && u.port !== "80" && u.port !== "443") throw new Error("blocked");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("blocked");
  }
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => ipPrivate(a.address))) throw new Error("blocked");
}

/** Đổi link Google/GitHub sang dạng tải văn bản thô. */
function rewrite(u: URL): { url: string; kind: "text" | "html" } | { unsupported: true } {
  const h = u.hostname.replace(/^www\./, "");
  const docId = u.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/)?.[1];
  if (h === "docs.google.com" && docId) {
    if (u.pathname.startsWith("/document/")) return { url: `https://docs.google.com/document/d/${docId}/export?format=txt`, kind: "text" };
    if (u.pathname.startsWith("/presentation/")) return { url: `https://docs.google.com/presentation/d/${docId}/export/txt`, kind: "text" };
    if (u.pathname.startsWith("/spreadsheets/")) return { url: `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`, kind: "text" };
  }
  if (h === "drive.google.com") return { unsupported: true };
  if (h === "github.com") {
    const [owner, repo, kind, branch, ...rest] = u.pathname.split("/").filter(Boolean);
    if (owner && repo && !kind) return { url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`, kind: "text" };
    if (owner && repo && kind === "blob" && branch && rest.length) {
      return { url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest.join("/")}`, kind: "text" };
    }
  }
  return { url: u.toString(), kind: "html" };
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const desc = decodeEntities(html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i)?.[1] ?? "");
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text: text || desc };
}

async function fetchSafe(start: string): Promise<{ res: Response; finalUrl: URL }> {
  let url = new URL(start);
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(url);
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "user-agent": UA, accept: "text/html,text/plain,text/csv,application/json;q=0.9,*/*;q=0.5" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    return { res, finalUrl: url };
  }
  throw new Error("too many redirects");
}

async function readBody(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

const LOGIN_HOSTS = ["accounts.google.com", "login.microsoftonline.com", "github.com/login"];

export async function readEvidence(rawLink: string): Promise<Evidence> {
  if (!rawLink) return { status: "none", title: "", text: "" };
  let u: URL;
  try {
    u = new URL(rawLink);
  } catch {
    return { status: "error", title: "", text: "" };
  }
  const target = rewrite(u);
  if ("unsupported" in target) return { status: "unsupported", title: "", text: "" };

  try {
    const { res, finalUrl } = await fetchSafe(target.url);
    const landed = finalUrl.hostname + finalUrl.pathname;
    if (LOGIN_HOSTS.some((h) => landed.startsWith(h)) || res.status === 401 || res.status === 403) {
      return { status: "private", title: "", text: "" };
    }
    if (!res.ok) return { status: "error", title: "", text: "" };

    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const textual = /text\/|json|csv|xml/.test(type) || type === "";
    if (!textual) return { status: "unsupported", title: "", text: "" };

    const body = await readBody(res);
    let title = "";
    let text = body;
    if (type.includes("html") || /^\s*<!doctype html|^\s*<html/i.test(body)) {
      ({ title, text } = htmlToText(body));
      // Google trả trang đăng nhập dạng HTML khi tài liệu riêng tư
      if (target.kind === "text" && /accounts\.google\.com|ServiceLogin/i.test(body)) {
        return { status: "private", title: "", text: "" };
      }
    }
    text = text.replace(/\u0000/g, "").trim().slice(0, MAX_TEXT);
    title = title.slice(0, 200);
    if (text.length >= 80) return { status: "ok", title, text };
    if (title) return { status: "limited", title, text };
    return { status: "limited", title: "", text };
  } catch (e) {
    if (e instanceof Error && e.message === "blocked") return { status: "error", title: "", text: "" };
    return { status: "error", title: "", text: "" };
  }
}
