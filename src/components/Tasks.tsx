"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  ExternalLink,
  HandHelping,
  MessageSquare,
  PlayCircle,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useProject } from "./ProjectProvider";
import { Alert, Avatar, Badge, Button, Card, Field, ProgressBar, inputCls, useArmed } from "./ui";
import { api } from "@/lib/client";
import { TASK_STATUS_LABELS, type Task, type TaskStatus } from "@/lib/types";
import { cn, domainOf, formatDate, todayISO } from "@/lib/utils";

/* ---------- helpers ---------- */

type Tone = "slate" | "amber" | "rose" | "emerald" | "indigo";

/** Hạn nộp có cả giờ (theo mẫu Progress Tracker, ví dụ 06/11/2026 23:00). */
function dueInfo(t: Task): { label: string; tone: Tone } {
  if (t.status === "done") return { label: "Đã hoàn thành", tone: "emerald" };
  if (!t.dueDate) return { label: "Không có hạn", tone: "slate" };
  const when = `${formatDate(t.dueDate)}${t.dueTime ? ` ${t.dueTime}` : ""}`;
  const deadline = new Date(`${t.dueDate}T${t.dueTime || "23:59"}:00`).getTime();
  const msLeft = deadline - Date.now();
  if (msLeft < 0) {
    const days = Math.floor(-msLeft / 86_400_000);
    return { label: days >= 1 ? `Quá hạn ${days} ngày (${when})` : `Quá hạn (${when})`, tone: "rose" };
  }
  const days = Math.round((Date.parse(t.dueDate) - Date.parse(todayISO())) / 86_400_000);
  if (days === 0) return { label: `Hạn hôm nay${t.dueTime ? ` ${t.dueTime}` : ""}`, tone: "amber" };
  if (days <= 2) return { label: `Còn ${days} ngày (${when})`, tone: "amber" };
  return { label: `Hạn ${when}`, tone: "slate" };
}

/** Trạng thái theo mẫu sheet: Pending / Đang làm / Chờ duyệt / Completed & Approved / Cần sửa */
function stateBadge(t: Task): { label: string; tone: Tone } {
  if (t.approval === "revise") return { label: "Cần sửa lại", tone: "rose" };
  if (t.status === "done" && t.approval === "approved") return { label: "Completed & Approved", tone: "emerald" };
  if (t.status === "done") return { label: "Chờ trưởng nhóm duyệt", tone: "amber" };
  if (t.status === "doing") return { label: "Đang làm", tone: "indigo" };
  return { label: "Pending", tone: "slate" };
}

const STATUS_ORDER: Record<TaskStatus, number> = { doing: 0, todo: 1, done: 2 };
const sortTasks = (a: Task, b: Task) =>
  STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.dueDate || "9999").localeCompare(b.dueDate || "9999");

function StatusIcon({ t }: { t: Task }) {
  if (t.status === "done" && t.approval === "approved") return <BadgeCheck className="h-5 w-5 text-emerald-600" />;
  if (t.status === "done") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (t.status === "doing") return <PlayCircle className="h-5 w-5 text-indigo-500" />;
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

  const patch = (t: Task, body: Record<string, unknown>) =>
    run(t.id, () => api(`/api/projects/${code}/tasks/${t.id}`, { method: "PATCH", session, body }));

  return {
    busyId,
    error,
    setStatus: (t: Task, status: TaskStatus, productLink?: string) =>
      patch(t, productLink !== undefined ? { status, productLink } : { status }),
    review: (t: Task, approval: "approved" | "revise") => patch(t, { approval }),
    remove: (t: Task) => run(t.id, () => api(`/api/projects/${code}/tasks/${t.id}`, { method: "DELETE", session })),
  };
}

/** Chi tiết dùng chung: yêu cầu đánh số, người hỗ trợ, link sản phẩm */
function TaskDetails({ t }: { t: Task }) {
  const { data } = useProject();
  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name ?? "Thành viên";
  return (
    <>
      {t.description && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{t.description}</p>}
      {t.requirements.length > 0 && (
        <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
          {t.requirements.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ol>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {t.supporterIds.length > 0 && (
          <span className="inline-flex items-center gap-1">
            <HandHelping className="h-3.5 w-3.5" /> Hỗ trợ: {t.supporterIds.map(nameOf).join(", ")}
          </span>
        )}
        {t.productLink && (
          <a
            href={t.productLink}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Sản phẩm ({domainOf(t.productLink)})
          </a>
        )}
      </div>
    </>
  );
}

/* ---------- Nhiệm vụ của tôi (phụ trách + hỗ trợ) ---------- */

function MyTaskItem({ t, role }: { t: Task; role: "owner" | "support" }) {
  const { code } = useProject();
  const { busyId, error, setStatus } = useTaskActions();
  const [finishing, setFinishing] = useState(false);
  const [link, setLink] = useState(t.productLink);
  const due = dueInfo(t);
  const st = stateBadge(t);
  const busy = busyId === t.id;

  return (
    <li className={cn("rounded-xl border bg-white p-3.5", t.status === "done" ? "border-slate-200 opacity-80" : "border-slate-200 shadow-sm")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5">
          <StatusIcon t={t} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-semibold text-slate-900", t.status === "done" && "line-through decoration-slate-400")}>{t.title}</p>
          <TaskDetails t={t} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={due.tone === "indigo" ? "indigo" : due.tone}>
              <CalendarClock className="h-3 w-3" /> {due.label}
            </Badge>
            <Badge tone={st.tone}>{st.label}</Badge>
            {role === "support" && <Badge tone="slate">Bạn hỗ trợ</Badge>}
          </div>
        </div>
      </div>

      {role === "owner" && (
        <div className="mt-3 space-y-2 pl-8">
          {finishing ? (
            <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
              <Field label="Link sản phẩm (không bắt buộc)" hint="Bản Docs/Slides/Canva/video… để trưởng nhóm kiểm tra và duyệt.">
                <input className={inputCls + " !py-1.5"} name="productLink" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
              </Field>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  loading={busy}
                  onClick={async () => {
                    await setStatus(t, "done", link);
                    setFinishing(false);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> Nộp & hoàn thành
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFinishing(false)}>
                  Huỷ
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {t.status === "todo" && (
                <Button size="sm" loading={busy} onClick={() => setStatus(t, "doing")}>
                  <PlayCircle className="h-4 w-4" /> Bắt đầu
                </Button>
              )}
              {t.status === "doing" && (
                <Button size="sm" onClick={() => setFinishing(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Hoàn thành
                </Button>
              )}
              {t.status === "done" && t.approval !== "approved" && (
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
          )}
          {error && <Alert tone="error">{error}</Alert>}
        </div>
      )}
      <TaskNotes task={t} />
    </li>
  );
}

export function MyTasksCard({ onAdd }: { onAdd: () => void }) {
  const { data } = useProject();
  const mine = data.tasks.filter((t) => t.assigneeId === data.me.id).sort(sortTasks);
  const supporting = data.tasks.filter((t) => t.supporterIds.includes(data.me.id) && t.assigneeId !== data.me.id).sort(sortTasks);
  const open = mine.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => dueInfo(t).tone === "rose").length;
  const revise = mine.filter((t) => t.approval === "revise").length;

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
                : `Còn ${open.length} việc cần làm${overdue ? ` · ${overdue} việc quá hạn` : ""}${revise ? ` · ${revise} việc cần sửa` : ""}`}
          </p>
        </div>
        {data.me.isLeader && (
          <Button size="sm" variant="secondary" onClick={onAdd}>
            <UserPlus className="h-4 w-4" /> Giao việc
          </Button>
        )}
      </div>

      {mine.length === 0 && supporting.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 py-6 text-center text-sm text-slate-500">
          {data.me.isLeader
            ? "Hãy giao việc cho các thành viên (kể cả bản thân) để mọi người biết mình cần làm gì."
            : "Trưởng nhóm sẽ giao việc cho bạn ở đây. Khi có nhiệm vụ, bạn có thể ghi chú tiến độ hoặc vướng mắc vào từng việc."}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {mine.map((t) => (
            <MyTaskItem key={t.id} t={t} role="owner" />
          ))}
          {supporting.length > 0 && (
            <li className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Việc bạn hỗ trợ</li>
          )}
          {supporting.map((t) => (
            <MyTaskItem key={t.id} t={t} role="support" />
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Ghi chú vào nhiệm vụ ---------- */

function TaskNotes({ task }: { task: Task }) {
  const { code, session, data, refresh } = useProject();
  const notes = data.notes.filter((n) => n.taskId === task.id);
  const canWrite = task.assigneeId === data.me.id || task.supporterIds.includes(data.me.id) || data.me.isLeader;
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

/* ---------- Biểu mẫu giao việc (theo mẫu Progress Tracker) ---------- */

function AssignForm({ onDone }: { onDone: () => void }) {
  const { code, session, data, refresh } = useProject();
  const blank = { title: "", description: "", requirements: "", assigneeId: data.me.id, supporterIds: [] as string[], dueDate: "", dueTime: "23:00" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${code}/tasks`, { session, body: { ...f, dueTime: f.dueDate ? f.dueTime : "" } });
      await refresh();
      setF(blank);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  const toggleSupporter = (id: string) =>
    setF({ ...f, supporterIds: f.supporterIds.includes(id) ? f.supporterIds.filter((x) => x !== id) : [...f.supporterIds, id] });

  return (
    <form onSubmit={submit} className="mb-4 space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
      <h3 className="font-semibold text-slate-900">Giao việc mới</h3>
      <Field label="Tên nhiệm vụ (Task)" required>
        <input
          className={inputCls}
          name="taskTitle"
          value={f.title}
          maxLength={150}
          onChange={(e) => setF({ ...f, title: e.target.value })}
          placeholder="VD: Lên nội dung và kịch bản video"
          required
        />
      </Field>
      <Field label="Yêu cầu (Requirements)" hint="Mỗi dòng một yêu cầu, hệ thống tự đánh số. Tối đa 15 dòng.">
        <textarea
          className={`${inputCls} min-h-[96px]`}
          name="requirements"
          value={f.requirements}
          onChange={(e) => setF({ ...f, requirements: e.target.value })}
          placeholder={"Đọc kỹ nội dung và toàn bộ kiến thức liên quan\nBổ sung nội dung chưa rõ ràng\nNộp bản nháp trước hạn 1 ngày"}
        />
      </Field>
      <Field label="Ghi chú thêm (không bắt buộc)">
        <textarea
          className={`${inputCls} min-h-[56px]`}
          name="taskDescription"
          value={f.description}
          maxLength={600}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          placeholder="Sản phẩm cần nộp, tài liệu tham khảo…"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Người phụ trách (PIC)" required>
          <select
            className={inputCls}
            name="assignee"
            value={f.assigneeId}
            onChange={(e) => setF({ ...f, assigneeId: e.target.value, supporterIds: f.supporterIds.filter((x) => x !== e.target.value) })}
          >
            {data.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.id === data.me.id ? " (bạn)" : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hạn nộp">
          <input type="date" className={inputCls} name="dueDate" value={f.dueDate} min={todayISO()} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </Field>
        <Field label="Giờ">
          <input type="time" className={inputCls} name="dueTime" value={f.dueTime} disabled={!f.dueDate} onChange={(e) => setF({ ...f, dueTime: e.target.value })} />
        </Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-slate-700">Người hỗ trợ (Supporter)</legend>
        <div className="flex flex-wrap gap-2">
          {data.members
            .filter((m) => m.id !== f.assigneeId)
            .map((m) => (
              <label
                key={m.id}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm",
                  f.supporterIds.includes(m.id) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600"
                )}
              >
                <input type="checkbox" className="sr-only" checked={f.supporterIds.includes(m.id)} onChange={() => toggleSupporter(m.id)} />
                {m.name}
              </label>
            ))}
        </div>
      </fieldset>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex gap-2">
        <Button type="submit" loading={busy}>
          <Plus className="h-4 w-4" /> Giao việc
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}

/* ---------- Bảng phân công cả nhóm (Work Distribution) ---------- */

export function TeamTasksCard({ formOpen, setFormOpen }: { formOpen: boolean; setFormOpen: (v: boolean) => void }) {
  const { data } = useProject();
  const { busyId, error, remove, review } = useTaskActions();
  const { armed, arm } = useArmed();
  const isLeader = data.me.isLeader;

  const total = data.tasks.length;
  const approved = data.tasks.filter((t) => t.status === "done" && t.approval === "approved").length;
  const waiting = data.tasks.filter((t) => t.status === "done" && t.approval === "none").length;

  return (
    <Card>
      <div id="team-tasks" className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-900">Bảng phân công công việc</h2>
          <p className="text-xs text-slate-500">
            {total
              ? `${approved}/${total} nhiệm vụ Completed & Approved${waiting ? ` · ${waiting} việc chờ duyệt` : ""}`
              : "Chưa có nhiệm vụ nào"}
          </p>
        </div>
        {!formOpen && isLeader && (
          <Button size="sm" variant="secondary" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Giao việc
          </Button>
        )}
      </div>
      {total > 0 && <ProgressBar value={(approved / total) * 100} color="bg-emerald-500" className="mb-4" />}

      {formOpen && isLeader && <AssignForm onDone={() => setFormOpen(false)} />}
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
            const list = data.tasks.filter((t) => t.assigneeId === m.id).sort(sortTasks);
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
                <ul className="space-y-2 border-l-2 border-slate-200 pl-3">
                  {list.map((t) => {
                    const due = dueInfo(t);
                    const st = stateBadge(t);
                    const canDelete = isLeader || t.createdBy === data.me.id;
                    return (
                      <li key={t.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <StatusIcon t={t} />
                          <span className={cn("min-w-0 flex-1 truncate font-medium", t.status === "done" && "text-slate-500")} title={t.title}>
                            {t.title}
                          </span>
                          <Badge tone={st.tone} className="shrink-0">
                            {st.label}
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
                        </div>
                        <div className="ml-7 mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className={due.tone === "rose" ? "font-semibold text-rose-600" : ""}>{due.label}</span>
                          {t.requirements.length > 0 && <span>· {t.requirements.length} yêu cầu</span>}
                          {t.supporterIds.length > 0 && (
                            <span>
                              · Hỗ trợ: {t.supporterIds.map((id) => data.members.find((x) => x.id === id)?.name ?? "?").join(", ")}
                            </span>
                          )}
                          {t.productLink && (
                            <a href={t.productLink} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline">
                              · <ExternalLink className="h-3 w-3" /> Sản phẩm
                            </a>
                          )}
                        </div>
                        {isLeader && t.status === "done" && t.approval !== "approved" && (
                          <div className="ml-7 mt-1.5 flex gap-2">
                            <Button size="sm" loading={busyId === t.id} onClick={() => review(t, "approved")}>
                              <BadgeCheck className="h-4 w-4" /> Duyệt
                            </Button>
                            <Button size="sm" variant="secondary" disabled={busyId === t.id} onClick={() => review(t, "revise")}>
                              <RotateCcw className="h-4 w-4" /> Yêu cầu sửa
                            </Button>
                          </div>
                        )}
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
