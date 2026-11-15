export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts[parts.length - 1] ?? "?";
  const first = parts.length > 1 ? parts[0] : "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

const COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

export function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** yyyy-mm-dd theo giờ địa phương của trình duyệt */
export function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function dayLabel(iso: string) {
  const today = todayISO();
  const y = new Date(Date.now() - 86_400_000);
  const yesterday = new Date(y.getTime() - y.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (iso === today) return "Hôm nay";
  if (iso === yesterday) return "Hôm qua";
  return formatDate(iso);
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
}

export function domainOf(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
}

export function fmtNum(n: number, d = 1) {
  return Number.isInteger(n) ? String(n) : n.toFixed(d);
}
