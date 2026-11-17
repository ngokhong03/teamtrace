"use client";

import { CheckCircle2, ClipboardList, Clock, ExternalLink, FileSearch, MessageSquare, Pencil, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { Avatar, Badge, ProgressBar, useArmed } from "./ui";
import { dayLabel, domainOf, fmtNum, timeAgo } from "@/lib/utils";
import { EVIDENCE_LABELS, type Activity, type EvidenceStatus, type WorkLog } from "@/lib/types";

const EVIDENCE_TONE: Record<EvidenceStatus, "emerald" | "amber" | "rose" | "slate"> = {
  none: "slate",
  ok: "emerald",
  limited: "amber",
  private: "rose",
  unsupported: "slate",
  error: "rose",
};

export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  if (status === "none") return null;
  return (
    <Badge tone={EVIDENCE_TONE[status]}>
      <FileSearch className="h-3 w-3" /> {EVIDENCE_LABELS[status]}
    </Badge>
  );
}

/** Sự kiện nhiệm vụ hiện trên timeline (sự kiện công việc đã có thẻ riêng). */
const EVENT_TYPES = ["task_assigned", "task_status", "task_note", "member_joined"];

function eventIcon(a: Activity) {
  if (a.type === "task_assigned") return <ClipboardList className="h-4 w-4 text-indigo-600" />;
  if (a.type === "task_status") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (a.type === "task_note") return <MessageSquare className="h-4 w-4 text-sky-600" />;
  return <UserPlus className="h-4 w-4 text-slate-500" />;
}

type Item = { kind: "log"; at: string; log: WorkLog } | { kind: "event"; at: string; ev: Activity };

const localDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export default function Timeline({
  logs,
  events = [],
  nameOf,
  meId,
  onDelete,
  onEdit,
  onRecheck,
  recheckingId,
  emptyText = "Chưa có hoạt động nào.",
}: {
  logs: WorkLog[];
  events?: Activity[];
  nameOf: (id: string) => string;
  meId?: string;
  onDelete?: (log: WorkLog) => void;
  /** Sửa công việc của chính mình */
  onEdit?: (log: WorkLog) => void;
  /** Đọc lại link minh chứng (hiện cho log của chính mình khi chưa đọc được) */
  onRecheck?: (log: WorkLog) => void;
  recheckingId?: string | null;
  emptyText?: string;
}) {
  const { armed, arm } = useArmed();

  const items: Item[] = [
    ...logs.map((log) => ({ kind: "log" as const, at: log.createdAt, log })),
    ...events.filter((e) => EVENT_TYPES.includes(e.type)).map((ev) => ({ kind: "event" as const, at: ev.createdAt, ev })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const d = localDate(it.at);
    groups.set(d, [...(groups.get(d) ?? []), it]);
  }

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, list]) => (
        <section key={date}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(date)}</h3>
          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
            {list.map((it) => {
              if (it.kind === "event") {
                const a = it.ev;
                const actor = a.actorId ? nameOf(a.actorId) : "Ai đó";
                const note = a.type === "task_note" ? String((a.detail as { content?: string }).content ?? "") : "";
                return (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[25px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-4 ring-slate-50">
                      {eventIcon(a)}
                    </span>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-sm">
                      <p className="text-slate-700">
                        <b className="text-slate-900">{actor}</b> {a.summary}
                        <span className="text-xs text-slate-400"> · {timeAgo(a.createdAt)}</span>
                      </p>
                      {note && <p className="mt-1 whitespace-pre-line text-slate-600">“{note}”</p>}
                    </div>
                  </li>
                );
              }
              const l = it.log;
              const name = nameOf(l.memberId);
              const mine = meId === l.memberId;
              return (
                <li key={l.id} className="relative">
                  <span className="absolute -left-[25px] top-1 rounded-full ring-4 ring-slate-50">
                    <Avatar name={name} size={16} />
                  </span>
                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{l.task}</p>
                        <p className="text-xs text-slate-500">
                          {name} · {timeAgo(l.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge tone="indigo">{l.category}</Badge>
                        {onEdit && mine && (
                          <button
                            onClick={() => onEdit(l)}
                            aria-label="Sửa công việc"
                            className="rounded-md p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {onDelete && mine &&
                          (armed === l.id ? (
                            <button
                              onClick={() => {
                                arm(null);
                                onDelete(l);
                              }}
                              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700"
                            >
                              Bấm lần nữa để xoá
                            </button>
                          ) : (
                            <button
                              onClick={() => arm(l.id)}
                              aria-label="Xoá công việc"
                              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ))}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{l.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex min-w-[130px] items-center gap-2">
                        <ProgressBar value={l.percent} className="w-20" color={l.percent >= 100 ? "bg-emerald-500" : "bg-indigo-500"} />
                        {l.percent}%
                      </span>
                      {l.link ? (
                        <a
                          href={l.link}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> {domainOf(l.link)}
                        </a>
                      ) : (
                        <span className="text-amber-600">Chưa có minh chứng</span>
                      )}
                      <EvidenceBadge status={l.evidenceStatus} />
                      {onRecheck && mine && l.link && l.evidenceStatus !== "ok" && (
                        <button
                          onClick={() => onRecheck(l)}
                          disabled={recheckingId === l.id}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-0.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${recheckingId === l.id ? "animate-spin" : ""}`} /> Đọc lại link
                        </button>
                      )}
                    </div>
                    {mine && (l.evidenceStatus === "private" || l.evidenceStatus === "error") && (
                      <p className="mt-2 rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700">
                        AI chưa đọc được link này. Với Google Docs/Slides/Sheets, hãy bật chia sẻ “Bất kỳ ai có đường liên kết” rồi bấm “Đọc lại link”.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
