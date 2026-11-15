"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Alert, Button, Field, inputCls } from "./ui";
import { api } from "@/lib/client";
import { useProject } from "./ProjectProvider";
import { CATEGORIES } from "@/lib/types";
import { todayISO } from "@/lib/utils";

const initial = () => ({
  task: "",
  description: "",
  link: "",
  category: "Nghiên cứu" as string,
  hours: "1",
  percent: 100,
  workDate: todayISO(),
});

export default function TaskForm({ onSaved }: { onSaved: () => void }) {
  const { code, session } = useProject();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${code}/logs`, { session, body: { ...f, hours: Number(f.hours) } });
      setF(initial());
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
      <Field label="Link minh chứng" hint="Google Docs, Canva, Slides, GitHub, Figma… Việc có link được tính điểm cao hơn.">
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
        <Field label="Số giờ đã làm" required>
          <input
            type="number"
            min={0.25}
            max={40}
            step={0.25}
            className={inputCls}
            value={f.hours}
            onChange={(e) => setF({ ...f, hours: e.target.value })}
            required
          />
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
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" loading={busy} size="lg" className="w-full sm:w-auto">
        <Plus className="h-4 w-4" /> Ghi nhận công việc
      </Button>
    </form>
  );
}
