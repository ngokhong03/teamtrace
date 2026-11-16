"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, Circle, MessageSquare, PlayCircle, Plus, RotateCcw, Send, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useProject } from "./ProjectProvider";
import { Alert, Avatar, Badge, Button, Card, Field, ProgressBar, inputCls, useArmed } from "./ui";
import { api } from "@/lib/client";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/lib/types";
import { cn, formatDate, todayISO } from "@/lib/utils";

/* ---------- helpers ---------- */

function dueInfo(t: Task): { label: string; tone: "slate" | "amber" | "rose" | "emerald" } {
  if (t.status === "done") return { label: "Hoàn thành", tone: "emerald" };
  if (!t.dueDate) return { label: "Không có hạn", tone: "slate" };
  const days = Math.round((Date.parse(t.dueDate) - Date.parse(todayISO())) / 86_400_000);
  if (days < 0) return { label: `Quá hạn ${-days} ngày`, tone: "rose" };
  if (days === 0) return { label: "Hạn hôm nay", tone: "amber" };
  if (days <= 2) return { label: `Còn ${days} ngày`, tone: "amber" };
  return { label: `Hạn ${formatDate(t.dueDate)}`, tone: "slate" };
}

const STATUS_ORDER: Record<TaskStatus, number> = { doing: 0, todo: 1, done: 2 };

function StatusIcon({ s }: { s: TaskStatus }) {
  if (s === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (s === "doing") return <PlayCircle className="h-5 w-5 text-indigo-500" />;
  return <Circle className="h-5 w-5 text-slate-300" />;
}

function useTaskActions() {
  const { code, session, refresh } = useProject();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusyId(null);
    }
  }

  return {
    busyId,
    error,
    setStatus: (t: Task, status: TaskStatus) =>
      run(t.id, () => api(`/api/projects/${code}/tasks/${t.id}`, { method: "PATCH", session, body: { status } })),
    remove: (t: Task) => run(t.id, () => api(`/api/projects/${code}/tasks/${t.id}`, { method: "DELETE", session })),
  };
}

/* ---------- Nhiệm vụ của tôi ---------- */

export function MyTasksCard({ onAdd }: { onAdd: () => void }) {
  const { code, data } = useProject();
  const { busyId, error, setStatus } = useTaskActions();

  const mine = data.tasks
    .filter((t) => t.assigneeId === data.me.id)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
  const open = mine.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => dueInfo(t).tone === "rose").length;

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ClipboardList className="h-5 w-5 text-indigo-600" /> Nhiệm vụ của bạn
          </h2>
          <p className="text-sm text-slate-500">
            {mine.length === 0
              ? "Bạn chưa được giao nhiệm vụ nào."
              : open.length === 0
                ? "Bạn đã hoàn thành tất cả nhiệm vụ được giao 🎉"
                : `Còn ${open.length} việc cần làm${overdue ? ` · ${overdue} việc quá hạn` : ""}`}
          </p>
        </div>
        {data.me.isLeader && (
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <UserPlus className="h-4 w-4" /> Giao việc
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {mine.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-6 text-center text-sm text-slate-500">
          {data.me.isLeader
            ? "Hãy giao việc cho các thành viên (kể cả bản thân) để mọi người biết mình cần làm gì."
            : "Trưởng nhóm sẽ giao việc cho bạn ở đây. Khi có nhiệm vụ, bạn có thể ghi chú tiến độ hoặc vướng mắc vào từng việc."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {mine.map((t) => {
            const due = dueInfo(t);
            const busy = busyId === t.id;
            return (
              <li key={t.id} className={cn("rounded-xl border bg-white p-3.5", t.status === "done" ? "border-slate-200 opacity-75" : "border-slate-200 shadow-sm")}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5">
                    <StatusIcon s={t.status} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-semibold text-slate-900", t.status === "done" && "line-through decoration-slate-400")}>{t.title}</p>
                    {t.description && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone={due.tone}>
                        <CalendarClock className="h-3 w-3" /> {due.label}
                      </Badge>
                      <Badge tone={t.status === "doing" ? "indigo" : "slate"}>{TASK_STATUS_LABELS[t.status]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 pl-8">
                  {t.status === "todo" && (
                    <Button size="sm" loading={busy} onClick={() => setStatus(t, "doing")}>
                      <PlayCircle className="h-4 w-4" /> Bắt đầu
                    </Button>
                  )}
                  {t.status === "doing" && (
                    <Button size="sm" loading={busy} onClick={() => setStatus(t, "done")}>
                      <CheckCircle2 className="h-4 w-4" /> Hoàn thành
                    </Button>
                  )}
                  {t.status === "done" && (
                    <Button size="sm" variant="ghost" loading={busy} onClick={() => setStatus(t, "doing")}>
                      <RotateCcw className="h-4 w-4" /> Mở lại
                    </Button>
                  )}
                  {t.status !== "done" && (
                    <Link
                      href={`/p/${code}/log`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Plus className="h-4 w-4" /> Ghi nhận công việc
                    </Link>
                  )}
                </div>
                <TaskNotes task={t} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Ghi chú vào nhiệm vụ ---------- */

function TaskNotes({ task }: { task: Task }) {
  const { code, session, data, refresh } = useProject();
  const notes = data.notes.filter((n) => n.taskId === task.id);
  const canWrite = task.assigneeId === data.me.id || data.me.isLeader;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name ?? "Thành viên";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${code}/tasks/${task.id}/notes`, { session, body: { content: text } });
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được ghi chú");
    } finally {
      setBusy(false);
    }
  }

  if (!notes.length && !canWrite) return null;
  return (
    <div className="mt-3 border-t border-slate-100 pl-8 pt-2">
      <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600">
        <MessageSquare className="h-3.5 w-3.5" /> {notes.length ? `${notes.length} ghi chú` : "Thêm ghi chú"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {notes.map((n) => (
            <p key={n.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700">
              <b className="text-slate-900">{nameOf(n.memberId)}:</b> <span className="whitespace-pre-line">{n.content}</span>
            </p>
          ))}
          {canWrite && (
            <form onSubmit={send} className="flex gap-2">
              <input
                className={inputCls + " !py-1.5"}
                name="note"
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ghi chú tiến độ, vướng mắc, link tham khảo…"
              />
              <Button type="submit" size="sm" loading={busy} aria-label="Gửi ghi chú">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      )}
    </div>
  );
}

/* ---------- Biểu mẫu giao việc ---------- */

function AssignForm({ onDone }: { onDone: () => void }) {
  const { code, session, data, refresh } = useProject();
  const isLeader = data.me.isLeader;
  const [f, setF] = useState({ title: "", description: "", assigneeId: data.me.id, dueDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${code}/tasks`, { session, body: f });
      await refresh();
      setF({ title: "", description: "", assigneeId: data.me.id, dueDate: "" });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <h3 className="font-semibold text-slate-900">{isLeader ? "Giao việc mới" : "Tự nhận việc mới"}</h3>
      <Field label="Tên nhiệm vụ" required>
        <input
          className={inputCls}
          name="taskTitle"
          value={f.title}
          maxLength={150}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="VD: Khảo sát 50 sinh viên về giá ống hút"
          required
        />
      </Field>
      <Field label="Mô tả (không bắt buộc)">
        <textarea
          className={`${inputCls} min-h-[64px]`}
          name="taskDescription"
          value={f.description}
          maxLength={600}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          placeholder="Cần làm gì, sản phẩm nộp là gì"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {isLeader && (
          <Field label="Giao cho" required>
            <select className={inputCls} name="assignee" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
              {data.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === data.me.id ? " (bạn)" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Hạn nộp">
          <input type="date" className={inputCls} name="dueDate" value={f.dueDate} min={todayISO()} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          <Plus className="h-4 w-4" /> {isLeader ? "Giao việc" : "Nhận việc"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

/* ---------- Nhiệm vụ cả nhóm ---------- */

export function TeamTasksCard({ formOpen, setFormOpen }: { formOpen: boolean; setFormOpen: (v: boolean) => void }) {
  const { data } = useProject();
  const { busyId, error, remove } = useTaskActions();
  const { armed, arm } = useArmed();

  const total = data.tasks.length;
  const done = data.tasks.filter((t) => t.status === "done").length;

  return (
    <Card>
      <div id="team-tasks" className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Nhiệm vụ cả nhóm</h2>
          <p className="text-xs text-slate-500">
            {total ? `${done}/${total} nhiệm vụ đã hoàn thành` : "Chưa có nhiệm vụ nào"}
          </p>
        </div>
        {!formOpen && data.me.isLeader && (
          <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Giao việc
          </Button>
        )}
      </div>
      {total > 0 && <ProgressBar value={(done / total) * 100} color="bg-emerald-500" className="mb-4" />}

      {formOpen && data.me.isLeader && <AssignForm onDone={() => setFormOpen(false)} />}
      {error && (
        <div className="mb-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {total === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Chưa có nhiệm vụ nào được giao.</p>
      ) : (
        <div className="space-y-4">
          {data.members.map((m) => {
            const list = data.tasks
              .filter((t) => t.assigneeId === m.id)
              .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));
            if (!list.length) return null;
            return (
              <div key={m.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Avatar name={m.name} size={24} />
                  <span className="text-sm font-semibold text-slate-800">
                    {m.name} {m.id === data.me.id && <span className="font-normal text-slate-400">(bạn)</span>}
                  </span>
                  <span className="text-xs text-slate-500">
                    {list.filter((t) => t.status === "done").length}/{list.length} xong
                  </span>
                </div>
                <ul className="space-y-1.5 border-l-2 border-slate-200 pl-3">
                  {list.map((t) => {
                    const due = dueInfo(t);
                    const canDelete = data.me.isLeader || t.createdBy === data.me.id;
                    return (
                      <li key={t.id} className="flex items-center gap-2 text-sm">
                        <StatusIcon s={t.status} />
                        <span className={cn("min-w-0 flex-1 truncate", t.status === "done" && "text-slate-400 line-through")} title={t.title}>
                          {t.title}
                        </span>
                        <Badge tone={due.tone} className="shrink-0">
                          {due.label}
                        </Badge>
                        {canDelete &&
                          (armed === t.id ? (
                            <button
                              onClick={() => {
                                arm(null);
                                remove(t);
                              }}
                              className="shrink-0 rounded bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-rose-700"
                            >
                              Xoá?
                            </button>
                          ) : (
                            <button
                              onClick={() => arm(t.id)}
                              disabled={busyId === t.id}
                              aria-label="Xoá nhiệm vụ"
                              className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
