"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import JoinForm from "./JoinForm";
import { Alert, Card, Spinner } from "./ui";
import { ApiError, api, clearSession, getSession, type Session } from "@/lib/client";
import type { StateResponse } from "@/lib/types";

interface Ctx {
  code: string;
  session: Session;
  data: StateResponse;
  refresh: () => Promise<void>;
  logout: () => void;
}

const ProjectCtx = createContext<Ctx | null>(null);

export function useProject() {
  const c = useContext(ProjectCtx);
  if (!c) throw new Error("useProject phải nằm trong ProjectProvider");
  return c;
}

type Phase = "loading" | "join" | "ready" | "notfound" | "error";

export default function ProjectProvider({ code, children }: { code: string; children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<StateResponse | null>(null);
  const [info, setInfo] = useState<{ name: string; course: string } | null>(null);
  const [error, setError] = useState("");
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const load = useCallback(
    async (s: Session) => {
      try {
        const d = await api<StateResponse>(`/api/projects/${code}/state`, { session: s });
        setData(d);
        setPhase("ready");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          clearSession(code);
          setSession(null);
          setPhase("join");
        } else if (e instanceof ApiError && e.status === 404) {
          setPhase("notfound");
        } else {
          // lỗi mạng khi đang polling: giữ nguyên dữ liệu cũ
          setError(e instanceof Error ? e.message : "Lỗi không xác định");
          setPhase((p) => (p === "ready" ? p : "error"));
        }
      }
    },
    [code]
  );

  // Khởi tạo: có phiên -> tải dữ liệu; chưa có -> hiện form tham gia
  useEffect(() => {
    const s = getSession(code);
    if (s) {
      setSession(s);
      load(s);
      return;
    }
    api<{ name: string; course: string }>(`/api/projects/${code}`)
      .then((i) => {
        setInfo(i);
        setPhase("join");
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) setPhase("notfound");
        else {
          setError(e instanceof Error ? e.message : "Lỗi không xác định");
          setPhase("error");
        }
      });
  }, [code, load]);

  // Tự làm mới 15s/lần khi tab đang hiển thị
  useEffect(() => {
    if (phase !== "ready") return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && sessionRef.current) load(sessionRef.current);
    }, 15000);
    return () => clearInterval(t);
  }, [phase, load]);

  const refresh = useCallback(async () => {
    if (sessionRef.current) await load(sessionRef.current);
  }, [load]);

  const logout = useCallback(() => {
    clearSession(code);
    setSession(null);
    setData(null);
    setPhase("loading");
    api<{ name: string; course: string }>(`/api/projects/${code}`).then((i) => {
      setInfo(i);
      setPhase("join");
    });
  }, [code]);

  if (phase === "loading") return <Spinner />;

  if (phase === "notfound") {
    return (
      <Shell>
        <Alert tone="error">Không tìm thấy dự án có mã {code}. Hãy kiểm tra lại mã nhóm.</Alert>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-indigo-600">← Về trang chủ</Link>
      </Shell>
    );
  }

  if (phase === "error" && !data) {
    return (
      <Shell>
        <Alert tone="error">{error || "Không tải được dữ liệu."}</Alert>
        <button onClick={() => location.reload()} className="mt-4 text-sm font-semibold text-indigo-600">
          Thử lại
        </button>
      </Shell>
    );
  }

  if (phase === "join" || !session || !data) {
    return (
      <Shell>
        <JoinForm
          code={code}
          projectName={info?.name ?? "Dự án nhóm"}
          course={info?.course}
          onJoined={(s) => {
            setSession(s);
            setPhase("loading");
            load(s);
          }}
        />
      </Shell>
    );
  }

  return <ProjectCtx.Provider value={{ code, session, data, refresh, logout }}>{children}</ProjectCtx.Provider>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-xl font-extrabold text-slate-900">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
          <BarChart3 className="h-5 w-5" />
        </span>
        TeamTrace
      </Link>
      <Card className="p-5 sm:p-6">{children}</Card>
    </main>
  );
}
