"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { Alert, Button, Field, inputCls } from "./ui";
import { api, saveSession, type Session } from "@/lib/client";

export default function JoinForm({
  code,
  projectName,
  course,
  onJoined,
}: {
  code: string;
  projectName: string;
  course?: string;
  onJoined: (s: Session) => void;
}) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ memberId: string; token: string; name: string }>(`/api/projects/${code}/join`, {
        body: { name, studentId },
      });
      const s = { memberId: r.memberId, token: r.token, name: r.name };
      saveSession(code, s);
      onJoined(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-indigo-50 p-3.5">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Bạn được mời vào dự án</p>
        <p className="mt-0.5 text-lg font-bold text-slate-900">{projectName}</p>
        {course && <p className="text-sm text-slate-600">{course}</p>}
      </div>
      <Field label="Họ và tên" required>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" autoComplete="name" required />
      </Field>
      <Field
        label="Mã sinh viên"
        required
        hint="Dùng để vào lại dự án trên thiết bị khác – hãy nhập đúng mã của bạn."
      >
        <input className={inputCls} value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="VD: 2311110001" required />
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" loading={busy} className="w-full" size="lg">
        <LogIn className="h-4 w-4" /> Vào dự án
      </Button>
    </form>
  );
}
