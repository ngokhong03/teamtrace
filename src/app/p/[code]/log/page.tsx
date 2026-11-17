"use client";

import { useEffect, useRef, useState } from "react";
import { useProject } from "@/components/ProjectProvider";
import TaskForm from "@/components/TaskForm";
import AdSlot from "@/components/AdSlot";
import Timeline from "@/components/Timeline";
import { Alert, Card, PageTitle } from "@/components/ui";
import { api } from "@/lib/client";
import type { WorkLog } from "@/lib/types";

export default function LogPage() {
  const { code, session, data, refresh } = useProject();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [rechecking, setRechecking] = useState<string | null>(null);
  const [editing, setEditing] = useState<WorkLog | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Mở từ nút "Ghi nhận công việc" của một nhiệm vụ: /p/<code>/log?task=<id>
  useEffect(() => {
    setTaskId(new URLSearchParams(window.location.search).get("task"));
  }, []);
  const forTask = data.tasks.find((t) => t.id === taskId && (t.assigneeId === data.me.id || t.supporterIds.includes(data.me.id))) ?? null;
  function clearTask() {
    setTaskId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  async function recheck(l: WorkLog) {
    setRechecking(l.id);
    setError("");
    setInfo("");
    try {
      const r = await api<{ evidenceStatus: string }>(`/api/projects/${code}/logs/${l.id}`, {
        method: "PATCH",
        session,
        body: { recheck: true },
      });
      setInfo(r.evidenceStatus === "ok" ? "Đã đọc được nội dung link." : "Vẫn chưa đọc được link – hãy kiểm tra quyền chia sẻ.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc lại được link");
    } finally {
      setRechecking(null);
    }
  }
  const mine = data.logs.filter((l) => l.memberId === data.me.id);

  async function remove(l: WorkLog) {
    try {
      await api(`/api/projects/${code}/logs/${l.id}`, { method: "DELETE", session });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xoá được");
    }
  }

  return (
    <>
      <PageTitle title="Ghi nhận đóng góp (WorkTrace)" desc="Ghi lại những gì bạn đã làm kèm minh chứng – đây là căn cứ chính để tính điểm đóng góp." />
      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-2 lg:sticky lg:top-32 lg:self-start">
          <div ref={formRef} className="scroll-mt-32">
            <h2 className="mb-4 font-semibold text-slate-900">{editing ? "Sửa công việc" : "Thêm công việc mới"}</h2>
            <TaskForm onSaved={refresh} editing={editing} onCancelEdit={() => setEditing(null)} forTask={forTask} onClearTask={clearTask} />
          </div>
        </Card>
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold text-slate-900">Nhật ký của bạn</h2>
            <p className="text-sm text-slate-500">
              {mine.length} việc
            </p>
          </div>
          {error && (
            <div className="mb-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          {info && (
            <div className="mb-3">
              <Alert tone="info">{info}</Alert>
            </div>
          )}
          <Timeline
            logs={mine}
            nameOf={() => data.me.name}
            meId={data.me.id}
            onDelete={remove}
            onEdit={(l) => {
              setEditing(l);
              formRef.current?.scrollIntoView({ behavior: "smooth" });
            }}
            onRecheck={recheck}
            recheckingId={rechecking}
            emptyText="Bạn chưa ghi nhận công việc nào. Hãy điền form bên cạnh."
          />
          <div className="mt-6">
            <AdSlot />
          </div>
        </div>
      </div>
    </>
  );
}
