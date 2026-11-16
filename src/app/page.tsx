"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, EyeOff, Sparkles, Users, X } from "lucide-react";
import CreateProjectForm from "@/components/CreateProjectForm";
import { Alert, Avatar, Button, Card, inputCls } from "@/components/ui";
import { clearSession, listSessions, type SavedProject } from "@/lib/client";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedProject[]>([]);

  // Đọc localStorage sau khi mount (tránh lệch giữa server và client)
  useEffect(() => setSaved(listSessions()), []);

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return setError("Mã nhóm gồm 6 chữ số");
    router.push(`/p/${c}`);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:pt-14">
      <header className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <BarChart3 className="h-5 w-5" />
        </span>
        <span className="text-xl font-extrabold tracking-tight text-slate-900">TeamTrace</span>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <section>
          <p className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            Track – Evaluate – Grow
          </p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
            Làm việc nhóm minh bạch.
            <br />
            <span className="text-indigo-600">Đánh giá công bằng.</span>
          </h1>
          <p className="mt-4 max-w-lg text-slate-600">
            Mỗi thành viên ghi lại công việc kèm minh chứng, đánh giá chéo ẩn danh, và nhận báo cáo đóng góp có dữ liệu để
            nộp cho giảng viên – không còn cảnh người làm nhiều, người làm ít mà điểm như nhau.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              [Users, "Vào nhóm trong 10 giây", "Mã nhóm 6 số + tên + mã sinh viên + PIN tự đặt, không cần email hay mật khẩu."],
              [EyeOff, "Đánh giá chéo ẩn danh thật sự", "Hệ thống không lưu ai chấm ai, nên ai cũng dám nói thật."],
              [Sparkles, "Báo cáo đóng góp có AI", "Điểm 0–100, biểu đồ 5 trục và gợi ý cải thiện cho từng người."],
            ].map(([Icon, title, desc]) => {
              const I = Icon as typeof Users;
              return (
                <li key={title as string} className="flex gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200">
                    <I className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{title as string}</span>
                    <span className="block text-sm text-slate-500">{desc as string}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4">
        {saved.length > 0 && (
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Dự án của bạn trên thiết bị này</h2>
            <ul className="space-y-2">
              {saved.map((s) => (
                <li key={s.code} className="flex items-center gap-2">
                  <Link
                    href={`/p/${s.code}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/50"
                  >
                    <Avatar name={s.name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-900">
                        {s.projectName ?? `Nhóm ${s.code}`}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        Mã <span className="font-mono">{s.code}</span> · vào với tên {s.name}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500" />
                  </Link>
                  <button
                    aria-label="Xoá nhóm khỏi thiết bị này"
                    title="Xoá khỏi thiết bị này (cần nhập lại mã và PIN khi vào lại)"
                    onClick={() => {
                      clearSession(s.code);
                      setSaved(listSessions());
                    }}
                    className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card className="p-5 sm:p-6">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            {(
              [
                ["join", "Tham gia nhóm"],
                ["create", "Tạo nhóm mới"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-lg py-2 transition ${tab === k ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "join" ? (
            <form onSubmit={join} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Mã nhóm (6 chữ số)</span>
                <input
                  className={`${inputCls} text-center text-2xl font-bold tracking-[0.4em]`}
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, ""));
                    setError("");
                  }}
                  placeholder="000000"
                  autoFocus
                />
              </label>
              {error && <Alert tone="error">{error}</Alert>}
              <Button type="submit" className="w-full" size="lg">
                Tiếp tục <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-center text-xs text-slate-500">
                Đã tham gia trước đó? Nhập lại mã nhóm, đúng mã sinh viên và mã PIN bạn đã đặt để vào lại.
              </p>
            </form>
          ) : (
            <CreateProjectForm />
          )}
        </Card>
        </div>
      </div>
    </main>
  );
}
