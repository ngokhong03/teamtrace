"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BarChart3, EyeOff, Sparkles, Users } from "lucide-react";
import CreateProjectForm from "@/components/CreateProjectForm";
import { Alert, Button, Card, inputCls } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState<"join" | "create">("join");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

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
              [Users, "Vào nhóm trong 10 giây", "Chỉ cần mã 6 số + tên + mã sinh viên, không cần tài khoản."],
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
                Đã tham gia trước đó? Nhập lại mã nhóm và đúng mã sinh viên để vào lại.
              </p>
            </form>
          ) : (
            <CreateProjectForm />
          )}
        </Card>
      </div>
    </main>
  );
}
