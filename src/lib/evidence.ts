import { lookup } from "dns/promises";
import { isIP } from "net";
import { unzipSync, strFromU8 } from "fflate";
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
 * file PDF / Word (.docx) / PowerPoint (.pptx) / Excel (.xlsx) – link trực tiếp hoặc file trên Google Drive,
 * GitHub (thông tin repo + README + file trong repo), YouTube/Vimeo (tiêu đề, kênh),
 * trang web thường (kèm mô tả og:), file .txt/.md/.csv/.json.
 * Canva, Figma, Notion… chỉ đọc được tiêu đề/mô tả công khai; ảnh và video chỉ ghi nhận có link.
 */

const MAX_BYTES = 1_500_000;
const MAX_BINARY = 8_000_000; // PDF/Office
const MAX_TEXT_BINARY = 12_000;
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
type Target =
  | { url: string; kind: "text" | "html" | "oembed" | "github" | "binary"; extra?: string }
  | { unsupported: true };
function rewrite(u: URL): Target {
  const h = u.hostname.replace(/^www\./, "");
  const docId = u.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/)?.[1];
  if (h === "docs.google.com" && docId) {
    if (u.pathname.startsWith("/document/")) return { url: `https://docs.google.com/document/d/${docId}/export?format=txt`, kind: "text" };
    if (u.pathname.startsWith("/presentation/")) return { url: `https://docs.google.com/presentation/d/${docId}/export/txt`, kind: "text" };
    if (u.pathname.startsWith("/spreadsheets/")) return { url: `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv`, kind: "text" };
  }
  if (h === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/)?.[1] ?? u.searchParams.get("id");
    if (id && !u.pathname.startsWith("/drive/folders")) {
      return { url: `https://drive.google.com/uc?export=download&id=${id}`, kind: "binary" };
    }
    return { unsupported: true };
  }
  if (h === "youtube.com" || h === "m.youtube.com" || h === "youtu.be" || h === "vimeo.com") {
    const api = h === "vimeo.com" ? "https://vimeo.com/api/oembed.json?url=" : "https://www.youtube.com/oembed?format=json&url=";
    return { url: api + encodeURIComponent(u.toString()), kind: "oembed" };
  }
  if (h === "github.com") {
    const [owner, repo, kind, branch, ...rest] = u.pathname.split("/").filter(Boolean);
    if (owner && repo && !kind) {
      return { url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`, kind: "github", extra: `${owner}/${repo}` };
    }
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
  const desc = decodeEntities(
    html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*content=["']([^"']*)/i)?.[1] ?? ""
  );
  const body = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body)
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text: text.length < 200 && desc ? `${desc}\n${text}` : text || desc };
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

async function readBytes(res: Response, max = MAX_BYTES): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return Buffer.alloc(0); // file quá lớn: không đọc (tránh cắt cụt làm hỏng PDF/Office)
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function readBody(res: Response): Promise<string> {
  return new TextDecoder("utf-8", { fatal: false }).decode(await readBytes(res));
}

const xmlText = (xml: string, tag: string) =>
  [...xml.matchAll(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "g"))].map((m) => decodeEntities(m[1])).join(" ");

/** Rút chữ từ file Office (docx/pptx/xlsx = zip chứa XML) hoặc PDF. */
async function extractBinary(buf: Buffer): Promise<{ text: string; kind: string } | null> {
  if (buf.length < 8) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text: `[PDF ${totalPages} trang] ` + String(text), kind: "pdf" };
  }
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    const files = unzipSync(new Uint8Array(buf), {
      filter: (f) =>
        /^(word\/document\.xml|ppt\/slides\/slide\d+\.xml|xl\/sharedStrings\.xml)$/.test(f.name) && f.originalSize < 6_000_000,
    });
    const names = Object.keys(files);
    if (names.includes("word/document.xml")) {
      const xml = strFromU8(files["word/document.xml"]).replace(/<\/w:p>/g, "</w:t><w:t>\n");
      return { text: xmlText(xml, "w:t"), kind: "docx" };
    }
    const slides = names
      .filter((n) => n.startsWith("ppt/slides/"))
      .sort((a, b) => parseInt(a.replace(/\D/g, "")) - parseInt(b.replace(/\D/g, "")));
    if (slides.length) {
      return {
        text: `[${slides.length} slide] ` + slides.map((n, i) => `Slide ${i + 1}: ${xmlText(strFromU8(files[n]), "a:t")}`).join("\n"),
        kind: "pptx",
      };
    }
    if (names.includes("xl/sharedStrings.xml")) return { text: xmlText(strFromU8(files["xl/sharedStrings.xml"]), "t"), kind: "xlsx" };
  }
  return null;
}

/** Thông tin repo GitHub: mô tả, ngôn ngữ, commit gần đây (API công khai; lỗi hoặc hết lượt thì bỏ qua). */
async function githubMeta(repo: string): Promise<string> {
  try {
    const opt = {
      headers: { "user-agent": UA, accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store" as const,
    };
    const [info, commits] = await Promise.all([
      fetch(`https://api.github.com/repos/${repo}`, opt).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://api.github.com/repos/${repo}/commits?per_page=30`, opt).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (!info) return "";
    const list = Array.isArray(commits) ? (commits as { author?: { login?: string }; commit?: { message?: string } }[]) : [];
    const authors = new Set(list.map((c) => c.author?.login).filter(Boolean)).size;
    const msgs = list.slice(0, 8).map((c) => `- ${String(c.commit?.message ?? "").split("\n")[0].slice(0, 90)}`).join("\n");
    return [
      `[GitHub] ${info.full_name}: ${info.description ?? "(không có mô tả)"} · ngôn ngữ ${info.language ?? "?"} · cập nhật ${String(info.pushed_at ?? "").slice(0, 10)}`,
      list.length ? `${list.length} commit gần nhất từ ${authors} tài khoản:\n${msgs}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
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
    if (!res.ok && target.kind === "github" && target.extra) {
      // Repo không có README.md: vẫn dùng thông tin repo + commit
      const meta = await githubMeta(target.extra);
      return meta ? { status: "ok", title: target.extra, text: meta.slice(0, MAX_TEXT) } : { status: "error", title: "", text: "" };
    }
    if (!res.ok) return { status: "error", title: "", text: "" };

    const type = (res.headers.get("content-type") ?? "").toLowerCase();

    if (target.kind === "oembed") {
      const j = JSON.parse(await readBody(res)) as { title?: string; author_name?: string };
      const title = String(j.title ?? "").slice(0, 200);
      return { status: title ? "limited" : "error", title, text: j.author_name ? `Video của ${j.author_name}` : "" };
    }

    // File nhị phân (PDF / Word / PowerPoint / Excel) – link trực tiếp hoặc Google Drive
    const looksBinary = target.kind === "binary" || /pdf|officedocument|octet-stream|zip/.test(type);
    if (looksBinary) {
      const buf = await readBytes(res, MAX_BINARY);
      const out = await extractBinary(buf).catch(() => null);
      if (!out) return { status: buf.length ? "unsupported" : "limited", title: "", text: "" };
      const text = out.text.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").trim().slice(0, MAX_TEXT_BINARY);
      return { status: text.length >= 80 ? "ok" : "limited", title: out.kind.toUpperCase(), text };
    }

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
    if (target.kind === "github" && target.extra) {
      const meta = await githubMeta(target.extra);
      if (meta) text = `${meta}\n${text}`;
      title = title || target.extra;
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
