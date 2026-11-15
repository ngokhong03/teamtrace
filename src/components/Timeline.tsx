"use client";

import { Clock, ExternalLink, Trash2 } from "lucide-react";
import { Avatar, Badge, ProgressBar } from "./ui";
import { dayLabel, domainOf, fmtNum, timeAgo } from "@/lib/utils";
import type { WorkLog } from "@/lib/types";

export default function Timeline({
  logs,
  nameOf,
  meId,
  onDelete,
  emptyText = "Chưa có hoạt động nào.",
}: {
  logs: WorkLog[];
  nameOf: (id: string) => string;
  meId?: string;
  onDelete?: (log: WorkLog) => void;
  emptyText?: string;
}) {
  if (!logs.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  const groups = new Map<string, WorkLog[]>();
  for (const l of logs) groups.set(l.workDate, [...(groups.get(l.workDate) ?? []), l]);

  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([date, items]) => (
        <section key={date}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(date)}</h3>
          <ol className="relative space-y-3 border-l-2 border-slate-200 pl-4">
            {items.map((l) => {
              const name = nameOf(l.memberId);
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
                        {onDelete && meId === l.memberId && (
                          <button
                            onClick={() => onDelete(l)}
                            aria-label="Xoá công việc"
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-600">{l.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {fmtNum(l.hours)} giờ
                      </span>
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
                    </div>
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
