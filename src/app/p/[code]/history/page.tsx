"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, FileSearch, History, Lock, RefreshCw, Trash2 } from "lucide-react";
import { useProject } from "@/components/ProjectProvider";
import { EvidenceBadge } from "@/components/Timeline";
import { Alert, Avatar, Badge, Button, Card, PageTitle, inputCls } from "@/components/ui";
import { api } from "@/lib/client";
import type { Activity, ActivityType, WorkLog } from "@/lib/types";
import { domainOf, fmtNum } from "@/lib/utils";

const TYPE_LABELS: Record<ActivityType, string> = {
  member_joined: "Tham gia nhóm",
  task_assigned: "Giao việc",
  task_status: "Đổi trạng thái nhiệm vụ",
  task_note: "Ghi chú nhiệm vụ",
  task_deleted: "Xoá nhiệm vụ",
  log_added: "Ghi nhận công việc",
  log_deleted: "Xoá công việc",
  evidence_rechecked: "Đọc lại minh chứng",
  task_review: "Duyệt nhiệm vụ",
};

const TYPE_TONE: Partial<Record<ActivityType, "indigo" | "emerald" | "rose" | "amber" | "slate">> = {
  log_added: "indigo",
  log_deleted: "rose",
  task_deleted: "rose",
  task_assigned: "emerald",
  task_status: "emerald",
  task_note: "amber",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

/** Nội dung AI đọc được từ link – tải khi trưởng nhóm bấm xem */
function EvidenceViewer({ log }: { log: WorkLog }) {
  const { code, session, refresh } = useProject();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "recheck" | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setBusy("load");
    setError("");
    try {
      const r = await api<{ log: WorkLog & { evidenceText: string } }>(`/api/projects/${code}/logs/${log.id}`, { session });
      setText(r.log.evidenceText || "(Không có nội dung đọc được)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được");
    } finally {
      setBusy(null);
    }
  }

  async function recheck() {
    setBusy("recheck");
    setError("");
    try {
      await api(`/api/projects/${code}/logs/${log.id}`, { method: "PATCH", session, body: { recheck: true } });
      setText(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc lại được");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {log.link && (
          <a
            href={log.link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Mở link ({domainOf(log.link)})
          </a>
        )}
        <EvidenceBadge status={log.evidenceStatus} />
        {log.link && log.evidenceStatus === "ok" && text === null && (
          <Button size="sm" variant="secondary" onClick={load} loading={busy === "load"}>
            <FileSearch className="h-3.5 w-3.5" /> Xem nội dung AI đọc được
          </Button>
        )}
        {log.link && (
          <Button size="sm" variant="ghost" onClick={recheck} loading={busy === "recheck"}>
            <RefreshCw className="h-3.5 w-3.5" /> Đọc lại link
          </Button>
        )}
      </div>
      {log.evidenceTitle && <p className="text-xs text-slate-500">Tiêu đề trang: {log.evidenceTitle}</p>}
      {text !== null && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs text-slate-700">
          {text}
        </pre>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export default function HistoryPage() {
  const { code, data } = useProject();
  const [who, setWho] = useState("all");
  const [type, setType] = useState<"all" | ActivityType>("all");

  const nameOf = (id: string | null) => (id ? data.members.find((m) => m.id === id)?.name ?? "Thành viên đã rời" : "Hệ thống");
  const logById = useMemo(() => new Map(data.logs.map((l) => [l.id, l])), [data.logs]);

  const list = data.activities.filter((a) => (who === "all" || a.actorId === who) && (type === "all" || a.type === type));

  // Thống kê nhanh theo thành viên
  const perMember = data.members.map((m) => {
    const acts = data.activities.filter((a) => a.actorId === m.id);
    const logs = data.logs.filter((l) => l.memberId === m.id);
    return {
      m,
      added: acts.filter((a) => a.type === "log_added").length,
      deleted: acts.filter((a) => a.type === "log_deleted").length,
      unreadable: logs.filter((l) => l.link && l.evidenceStatus !== "ok" && l.evidenceStatus !== "limited").length,
      last: acts[0]?.createdAt,
    };
  });

  if (!data.me.isLeader) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <Lock className="mx-auto h-10 w-10 text-slate-400" />
        <p className="mt-3 text-sm text-slate-600">Chỉ trưởng nhóm mới xem được lịch sử hoạt động.</p>
        <Link href={`/p/${code}`} className="mt-3 inline-block text-sm font-semibold text-indigo-600">
          ← Về Tổng quan
        </Link>
      </Card>
    );
  }

  return (
    <>
      <PageTitle
        title="Lịch sử hoạt động"
        desc="Chỉ trưởng nhóm xem được. Mọi thao tác được ghi lại, kể cả công việc đã bị xoá. Đánh giá chéo không được ghi để giữ ẩn danh."
      />

      <Card>
        <h2 className="mb-3 font-semibold text-slate-900">Tóm tắt theo thành viên</h2>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 sm:px-2">Thành viên</th>
                <th className="px-2 py-2 text-right">Đã ghi nhận</th>
                <th className="px-2 py-2 text-right">Đã xoá</th>
                <th className="px-2 py-2 text-right">Link không đọc được</th>
                <th className="px-2 py-2 text-right">Hoạt động gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {perMember.map((r) => (
                <tr key={r.m.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50" onClick={() => setWho(r.m.id)}>
                  <td className="px-4 py-2.5 sm:px-2">
                    <span className="flex items-center gap-2">
                      <Avatar name={r.m.name} size={26} /> {r.m.name}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{r.added}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${r.deleted ? "font-semibold text-rose-600" : ""}`}>{r.deleted}</td>
                  <td className={`px-2 py-2.5 text-right tabular-nums ${r.unreadable ? "font-semibold text-amber-600" : ""}`}>{r.unreadable}</td>
                  <td className="px-2 py-2.5 text-right text-xs text-slate-500">{r.last ? fmtTime(r.last) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mb-3 mt-6 flex flex-wrap items-center gap-2">
        <History className="h-5 w-5 text-indigo-600" />
        <h2 className="mr-auto text-lg font-bold text-slate-900">Nhật ký chi tiết</h2>
        <select className={inputCls + " !w-auto !py-1.5"} name="filterMember" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Lọc theo thành viên">
          <option value="all">Tất cả thành viên</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select
          className={inputCls + " !w-auto !py-1.5"}
          name="filterType"
          value={type}
          onChange={(e) => setType(e.target.value as "all" | ActivityType)}
          aria-label="Lọc theo loại hoạt động"
        >
          <option value="all">Mọi hoạt động</option>
          {(Object.keys(TYPE_LABELS) as ActivityType[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {list.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Chưa có hoạt động phù hợp.</p>
      ) : (
        <ul className="space-y-2.5">
          {list.map((a: Activity) => {
            const log = a.logId ? logById.get(a.logId) : undefined;
            const d = a.detail as Record<string, string | number | undefined>;
            return (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Avatar name={nameOf(a.actorId)} size={24} />
                  <b className="text-slate-900">{nameOf(a.actorId)}</b>
                  <span className="text-slate-700">{a.summary}</span>
                  <Badge tone={TYPE_TONE[a.type] ?? "slate"} className="ml-auto">
                    {TYPE_LABELS[a.type]}
                  </Badge>
                  <span className="text-xs text-slate-400">{fmtTime(a.createdAt)}</span>
                </div>

                {a.type === "task_note" && d.content && <p className="mt-2 whitespace-pre-line text-sm text-slate-600">“{String(d.content)}”</p>}

                {a.type === "log_added" &&
                  (log ? (
                    <div className="mt-2 text-sm text-slate-600">
                      <p className="whitespace-pre-line">{log.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {fmtNum(log.hours)} giờ · hoàn thành {log.percent}% · ngày {log.workDate}
                      </p>
                      <EvidenceViewer log={log} />
                    </div>
                  ) : (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" /> Công việc này đã bị xoá sau đó
                    </p>
                  ))}

                {a.type === "log_deleted" && (
                  <div className="mt-2 rounded-lg bg-rose-50 p-2.5 text-sm text-rose-900">
                    <p className="font-semibold">Nội dung trước khi xoá</p>
                    {d.description && <p className="mt-1 whitespace-pre-line">{String(d.description)}</p>}
                    <p className="mt-1 text-xs">
                      {d.hours ?? "?"} giờ · {d.percent ?? "?"}% · ngày {String(d.workDate ?? "?")}
                    </p>
                    {d.link && (
                      <a href={String(d.link)} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold underline">
                        <ExternalLink className="h-3.5 w-3.5" /> {domainOf(String(d.link))}
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 text-center text-xs text-slate-400">Hiển thị tối đa 300 hoạt động gần nhất.</p>
    </>
  );
}
