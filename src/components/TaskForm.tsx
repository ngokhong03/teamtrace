"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Plus, Save } from "lucide-react";
import { Alert, Button, Field, inputCls } from "./ui";
import { api } from "@/lib/client";
import { useProject } from "./ProjectProvider";
import { CATEGORIES, EVIDENCE_LABELS, type Task, type WorkLog } from "@/lib/types";
import { todayISO } from "@/lib/utils";

const initial = () => ({
  task: "",
  description: "",
  link: "",
  category: "Nghiên cứu" as string,
  percent: 100,
  workDate: todayISO(),
});

export default function TaskForm({
  onSaved,
  editing,
  onCancelEdit,
  forTask,
  onClearTask,
}: {
  onSaved: () => void;
  /** Đang sửa một công việc đã ghi nhận */
  editing?: WorkLog | null;
  onCancelEdit?: () => void;
  /** Ghi nhận cho một nhiệm vụ được giao (mở từ nút "Ghi nhận công việc" của nhiệm vụ) */
  forTask?: Task | null;
  onClearTask?: () => void;
}) {
  const { code, session } = useProject();
  const [f, setF] = useState(initial);
  const [finishTask, setFinishTask] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "warn"; text: string } | null>(null);

  useEffect(() => {
    if (editing) {
      setF({
        task: editing.task,
        description: editing.description,
        link: editing.link,
        category: editing.category,
        percent: editing.percent,
        workDate: editing.workDate,
      });
      setNotice(null);
      setError("");
    } else if (forTask) {
      setF({ ...initial(), task: forTask.title, link: forTask.productLink || "" });
      setFinishTask(false);
    } else {
      setF(initial());
    }
  }, [editing, forTask]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice(null);
    try {
      if (editing) {
        await api(`/api/projects/${code}/logs/${editing.id}`, { method: "PATCH", session, body: { ...f } });
        setNotice({ tone: "success", text: "Đã lưu thay đổi." });
        onCancelEdit?.();
        onSaved();
        return;
      }
      const r = await api<{ log: WorkLog }>(`/api/projects/${code}/logs`, { session, body: { ...f } });
      let submitted = false;
      if (forTask && finishTask && forTask.status !== "done") {
        await api(`/api/projects/${code}/tasks/${forTask.id}`, {
          method: "PATCH",
          session,
          body: { status: "done", ...(f.link ? { productLink: f.link } : {}) },
        });
        submitted = true;
      }
      const st = r.log.evidenceStatus;
      const doneText = submitted ? ` Nhiệm vụ “${forTask!.title}” đã chuyển sang Hoàn thành, chờ trưởng nhóm duyệt.` : "";
      setNotice(
        st === "ok"
          ? { tone: "success", text: "Đã ghi nhận. AI đã đọc được nội dung link minh chứng." + doneText }
          : st === "none"
            ? { tone: "warn", text: "Đã ghi nhận. Nên thêm link minh chứng để được đánh giá đầy đủ." }
            : st === "private"
              ? { tone: "warn", text: "Đã ghi nhận, nhưng link đang để riêng tư nên AI không đọc được. Hãy bật chia sẻ “Bất kỳ ai có đường liên kết” rồi bấm “Đọc lại link” ở nhật ký." }
              : { tone: "warn", text: `Đã ghi nhận. ${EVIDENCE_LABELS[st]} – AI chỉ chấm được phần mô tả.` }
      );
      setF(initial());
      if (submitted) onClearTask?.();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {editing && (
        <Alert tone="info">
          Đang sửa công việc “{editing.task}”. Muốn gộp 2 lần ghi nhận thành 1: sửa một bản cho đầy đủ rồi xoá bản còn lại.
        </Alert>
      )}
      {!editing && forTask && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900">
          Ghi nhận cho nhiệm vụ <b>“{forTask.title}”</b>.{" "}
          <button type="button" onClick={onClearTask} className="font-semibold underline">
            Bỏ liên kết
          </button>
        </div>
      )}
      <Field label="Tên đầu việc" required>
        <input
          className={inputCls}
          value={f.task}
          onChange={(e) => setF({ ...f, task: e.target.value })}
          placeholder="VD: Phân tích đối thủ cạnh tranh"
          maxLength={150}
          required
        />
      </Field>
      <Field label="Đã làm cụ thể những gì?" required hint="Càng cụ thể (làm gì, kết quả ra sao) thì điểm đánh giá chất lượng càng cao. Tối thiểu 10 ký tự.">
        <textarea
          className={`${inputCls} min-h-[96px]`}
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
          placeholder="VD: Khảo sát 5 đối thủ, lập bảng so sánh giá/kênh phân phối, rút ra 3 khoảng trống thị trường…"
          maxLength={1500}
          required
        />
      </Field>
      <Field label="Link minh chứng" hint="AI đọc được nội dung Google Docs/Slides/Sheets, file PDF/Word/PowerPoint/Excel (kể cả trên Google Drive), GitHub và trang web — nhớ bật “Bất kỳ ai có đường liên kết”. YouTube/Canva/Figma chỉ đọc được tiêu đề; với Canva hãy xuất PDF rồi dán link Drive để AI đọc cả nội dung.">
        <input
          className={inputCls}
          value={f.link}
          onChange={(e) => setF({ ...f, link: e.target.value })}
          placeholder="https://docs.google.com/…"
          inputMode="url"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nhóm công việc">
          <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Ngày thực hiện" required>
          <input type="date" className={inputCls} value={f.workDate} max={todayISO()} onChange={(e) => setF({ ...f, workDate: e.target.value })} required />
        </Field>
      </div>
      <Field label={`Mức độ hoàn thành: ${f.percent}%`}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={f.percent}
          onChange={(e) => setF({ ...f, percent: Number(e.target.value) })}
          className="h-2 w-full cursor-pointer accent-indigo-600"
        />
      </Field>
      {!editing && forTask && forTask.status !== "done" && (
        <label className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-emerald-600"
            checked={finishTask}
            onChange={(e) => setFinishTask(e.target.checked)}
          />
          <span>
            <b>Nhiệm vụ này đã làm xong</b> – nộp luôn cho trưởng nhóm duyệt (link minh chứng sẽ được dùng làm link sản phẩm). Bỏ chọn nếu đây mới là một phần công việc.
          </span>
        </label>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} size="lg" className="w-full sm:w-auto">
          {editing ? (
            <>
              <Save className="h-4 w-4" /> Lưu thay đổi
            </>
          ) : finishTask && forTask ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Ghi nhận & nộp nhiệm vụ
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Ghi nhận công việc
            </>
          )}
        </Button>
        {editing && (
          <Button type="button" variant="ghost" size="lg" onClick={onCancelEdit}>
            Huỷ sửa
          </Button>
        )}
      </div>
    </form>
  );
}
