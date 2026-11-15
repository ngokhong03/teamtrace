"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";
import { Alert, Button, Field, inputCls } from "./ui";
import { api, saveSession } from "@/lib/client";

export default function CreateProjectForm() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", course: "", deadline: "", leaderName: "", leaderStudentId: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ code: string; memberId: string; token: string; name: string }>("/api/projects", { body: f });
      saveSession(r.code, { memberId: r.memberId, token: r.token, name: r.name });
      router.push(`/p/${r.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Tên dự án" required>
        <input className={inputCls} value={f.name} onChange={set("name")} placeholder="VD: Kế hoạch marketing cho thương hiệu X" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Môn học">
          <input className={inputCls} value={f.course} onChange={set("course")} placeholder="VD: Marketing căn bản – FTU" />
        </Field>
        <Field label="Deadline nộp bài">
          <input type="date" className={inputCls} value={f.deadline} onChange={set("deadline")} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Họ tên trưởng nhóm" required>
          <input className={inputCls} value={f.leaderName} onChange={set("leaderName")} placeholder="Nguyễn Văn A" required />
        </Field>
        <Field label="Mã sinh viên" required>
          <input className={inputCls} value={f.leaderStudentId} onChange={set("leaderStudentId")} placeholder="2311110001" required />
        </Field>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" loading={busy} className="w-full" size="lg">
        <Rocket className="h-4 w-4" /> Tạo dự án & lấy mã nhóm
      </Button>
      <p className="text-center text-xs text-slate-500">Sau khi tạo, bạn nhận mã 6 số để gửi cho các thành viên.</p>
    </form>
  );
}
