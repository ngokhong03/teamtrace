"use client";

import { useState } from "react";
import { useProject } from "@/components/ProjectProvider";
import TaskForm from "@/components/TaskForm";
import Timeline from "@/components/Timeline";
import { Alert, Card, PageTitle } from "@/components/ui";
import { api } from "@/lib/client";
import type { WorkLog } from "@/lib/types";

export default function LogPage() {
  const { code, session, data, refresh } = useProject();
  const [error, setError] = useState("");
  const mine = data.logs.filter((l) => l.memberId === data.me.id);
  const hours = mine.reduce((s, l) => s + l.hours, 0);

  async function remove(l: WorkLog) {
    if (!confirm(`Xoá công việc “${l.task}”?`)) return;
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
          <h2 className="mb-4 font-semibold text-slate-900">Thêm công việc mới</h2>
          <TaskForm onSaved={refresh} />
        </Card>
        <div className="lg:col-span-3">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold text-slate-900">Nhật ký của bạn</h2>
            <p className="text-sm text-slate-500">
              {mine.length} việc · {Math.round(hours * 10) / 10} giờ
            </p>
          </div>
          {error && (
            <div className="mb-3">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
          <Timeline
            logs={mine}
            nameOf={() => data.me.name}
            meId={data.me.id}
            onDelete={remove}
            emptyText="Bạn chưa ghi nhận công việc nào. Hãy điền form bên cạnh."
          />
        </div>
      </div>
    </>
  );
}
