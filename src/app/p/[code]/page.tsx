"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, Clock, Copy, Share2, Target, Users } from "lucide-react";
import { useProject } from "@/components/ProjectProvider";
import Timeline from "@/components/Timeline";
import HoursChart from "@/components/HoursChart";
import { MyTasksCard, TeamTasksCard } from "@/components/Tasks";
import AdSlot from "@/components/AdSlot";
import { Alert, Avatar, Badge, Button, Card, CopyFallback, PageTitle, copyText } from "@/components/ui";
import { hasLink, taskUnits } from "@/lib/scoring";
import { fmtNum, formatDate } from "@/lib/utils";

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="h-4 w-4 text-indigo-500" /> {label}
      </div>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export default function OverviewPage() {
  const { code, data } = useProject();
  const [copied, setCopied] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const nameOf = (id: string) => data.members.find((m) => m.id === id)?.name ?? "Thành viên";

  const approvedTasks = data.tasks.filter((t) => t.status === "done" && t.approval === "approved").length;
  const approvedPct = data.tasks.length ? Math.round((approvedTasks / data.tasks.length) * 100) : 0;

  const chart = data.members.map((m) => {
    const mine = data.logs.filter((l) => l.memberId === m.id);
    const effective = taskUnits(mine).units;
    return { name: m.name, hours: mine.length, effective: Math.round(effective * 10) / 10 };
  });

  const link = typeof window !== "undefined" ? `${location.origin}/p/${code}` : "";
  async function copyLink() {
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setFallback(link);
    }
  }

  return (
    <>
      <PageTitle title={`Xin chào, ${data.me.name}`} desc={`Tổng quan dự án “${data.project.name}” – theo dõi hoạt động cả nhóm theo thời gian thực.`} />

      <div className="mb-4">
        <MyTasksCard
          onAdd={() => {
            setFormOpen(true);
            setTimeout(() => document.getElementById("team-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
          }}
        />
      </div>

      {!data.me.submitted && data.members.length > 1 && (
        <div className="mb-4">
          <Alert tone="warn">
            Bạn chưa nộp đánh giá chéo.{" "}
            <Link href={`/p/${code}/review`} className="font-semibold underline">
              Đánh giá đồng đội ngay
            </Link>
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Mã tham gia nhóm</p>
              <p className="font-mono text-4xl font-extrabold tracking-[0.25em] text-indigo-600">{code}</p>
            </div>
            <Button variant="secondary" onClick={copyLink}>
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Đã sao chép" : "Sao chép link mời"}
            </Button>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Gửi link hoặc mã này cho thành viên – họ nhập Tên, Mã sinh viên và tự đặt mã PIN là vào được.
          </p>
          {fallback && (
            <div className="mt-3">
              <CopyFallback text={fallback} onClose={() => setFallback(null)} />
            </div>
          )}
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <CalendarClock className="h-4 w-4 text-indigo-500" /> Deadline
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{data.project.deadline ? formatDate(data.project.deadline) : "Chưa đặt"}</p>
          <p className="text-xs text-slate-500">{data.project.course || "—"}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Users} label="Thành viên" value={String(data.members.length)} sub={`${data.submittedCount}/${data.members.length} đã nộp đánh giá`} />
        <Stat icon={ClipboardList} label="Việc đã ghi nhận" value={String(data.logs.length)} sub={`${data.tasks.filter((t) => t.status === "done").length}/${data.tasks.length} nhiệm vụ xong`} />
        <Stat icon={Clock} label="Việc có minh chứng" value={`${data.logs.length ? Math.round((data.logs.filter(hasLink).length / data.logs.length) * 100) : 0}%`} />
        <Stat icon={Target} label="Nhiệm vụ đã duyệt" value={`${approvedPct}%`} sub={data.tasks.length ? `${approvedTasks}/${data.tasks.length} nhiệm vụ` : "Chưa giao nhiệm vụ"} />
      </div>

      <div className="mt-4">
        <TeamTasksCard formOpen={formOpen} setFormOpen={setFormOpen} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-3 font-semibold text-slate-900">Đóng góp quy đổi theo việc và % hoàn thành</h2>
          {data.logs.length ? (
            <HoursChart data={chart} />
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">Chưa có dữ liệu. Hãy ghi nhận công việc đầu tiên!</p>
          )}
          <p className="mt-2 text-xs text-slate-500">Mỗi đầu việc tính theo % hoàn thành (việc thiếu minh chứng chỉ tính 60%). Hệ thống không dùng số giờ tự khai.</p>
        </Card>
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold text-slate-900">Thành viên</h2>
          <ul className="space-y-3">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {m.name} {m.id === data.me.id && <span className="text-slate-400">(bạn)</span>}
                  </p>
                  <p className="text-xs text-slate-500">{data.logs.filter((l) => l.memberId === m.id).length} đầu việc</p>
                </div>
                {m.isLeader && <Badge tone="indigo">Trưởng nhóm</Badge>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-6">
        <AdSlot />
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Timeline hoạt động của nhóm</h2>
          <Link href={`/p/${code}/log`} className="text-sm font-semibold text-indigo-600 hover:underline">
            + Ghi nhận việc
          </Link>
        </div>
        <Timeline logs={data.logs} events={data.activities} nameOf={nameOf} emptyText="Chưa có hoạt động nào. Hãy là người đầu tiên ghi nhận công việc!" />
      </div>
    </>
  );
}
