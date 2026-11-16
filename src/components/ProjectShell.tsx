"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, FileBarChart, History, LayoutDashboard, LogOut, Star } from "lucide-react";
import ProjectProvider, { useProject } from "./ProjectProvider";
import { Avatar, Badge } from "./ui";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/log", label: "Ghi nhận", icon: ClipboardList },
  { href: "/review", label: "Đánh giá", icon: Star },
  { href: "/report", label: "Báo cáo", icon: FileBarChart },
];

function Frame({ children }: { children: React.ReactNode }) {
  const { code, data, logout } = useProject();
  const path = usePathname();
  const base = `/p/${code}`;
  const tabs = data.me.isLeader ? [...TABS, { href: "/history", label: "Lịch sử", icon: History }] : TABS;
  const active = (h: string) => (h === "" ? path === base : path.startsWith(base + h));

  return (
    <div className="min-h-screen pb-24 sm:pb-10">
      <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">TeamTrace</span>
          </Link>
          <div className="min-w-0 flex-1 border-l border-slate-200 pl-3">
            <p className="truncate text-sm font-semibold text-slate-900">{data.project.name}</p>
            <p className="truncate text-xs text-slate-500">
              Mã nhóm <span className="font-mono font-semibold text-indigo-600">{code}</span>
              {data.project.course ? ` · ${data.project.course}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Avatar name={data.me.name} size={30} />
            <span className="hidden text-sm font-medium text-slate-700 md:inline">{data.me.name}</span>
            {data.me.isLeader && <Badge tone="indigo" className="hidden sm:inline-flex">Trưởng nhóm</Badge>}
            <button
              onClick={logout}
              title="Đăng xuất khỏi thiết bị này"
              aria-label="Đăng xuất"
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-5xl gap-1 px-4 sm:flex">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={base + t.href}
              className={cn(
                "flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition",
                active(t.href) ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:py-6">{children}</main>

      <nav style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} className="no-print fixed inset-x-0 bottom-0 z-20 grid border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={base + t.href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold",
              active(t.href) ? "text-indigo-700" : "text-slate-500"
            )}
          >
            <t.icon className="h-5 w-5" /> {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export default function ProjectShell({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <ProjectProvider code={code}>
      <Frame>{children}</Frame>
    </ProjectProvider>
  );
}
