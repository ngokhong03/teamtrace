"use client";

import { useState } from "react";
import { Check, ClipboardCheck, Save } from "lucide-react";
import { useProject } from "./ProjectProvider";
import { Alert, Avatar, Badge, Button, Card, inputCls } from "./ui";
import { api } from "@/lib/client";
import { LEADER_RUBRIC, LEVELS, LEVEL_LABELS, rubricAverage } from "@/lib/rubric";
import { cn } from "@/lib/utils";

const LEVEL_STYLE: Record<number, string> = {
  4: "border-emerald-500 bg-emerald-50 text-emerald-800",
  3: "border-sky-500 bg-sky-50 text-sky-800",
  2: "border-amber-500 bg-amber-50 text-amber-800",
  1: "border-rose-500 bg-rose-50 text-rose-800",
};

function MemberRubric({ memberId, name }: { memberId: string; name: string }) {
  const { code, session, data, refresh } = useProject();
  const saved = data.assessments.find((a) => a.memberId === memberId);
  const [scores, setScores] = useState<Record<string, number>>(saved?.scores ?? {});
  const [comment, setComment] = useState(saved?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const complete = LEADER_RUBRIC.every((c) => scores[c.key]);

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/projects/${code}/assessments`, { method: "PUT", session, body: { memberId, scores, comment } });
      await refresh();
      setMsg({ tone: "success", text: "Đã lưu đánh giá." });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Không lưu được" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={name} size={36} />
        <p className="flex-1 font-semibold text-slate-900">{name}</p>
        {saved && (
          <Badge tone="emerald">
            <Check className="h-3 w-3" /> Đã chấm · {rubricAverage(saved.scores).toFixed(2)}/4
          </Badge>
        )}
      </div>
      <div className="space-y-4">
        {LEADER_RUBRIC.map((c) => (
          <div key={c.key}>
            <p className="mb-1.5 text-sm font-medium text-slate-800">{c.label}</p>
            <div className="grid gap-2 sm:grid-cols-4">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setScores({ ...scores, [c.key]: lv })}
                  aria-pressed={scores[c.key] === lv}
                  className={cn(
                    "rounded-xl border-2 p-2.5 text-left text-xs transition",
                    scores[c.key] === lv ? LEVEL_STYLE[lv] : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  )}
                >
                  <span className="block text-sm font-bold">
                    {LEVEL_LABELS[lv]} · {lv} điểm
                  </span>
                  <span className="mt-0.5 block leading-snug">{c.levels[lv]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Nhận xét của trưởng nhóm (không bắt buộc)</span>
          <textarea
            className={`${inputCls} min-h-[64px]`}
            name={`leaderComment-${memberId}`}
            value={comment}
            maxLength={1000}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Điểm mạnh, điều cần cải thiện, ví dụ cụ thể…"
          />
        </label>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Button onClick={save} loading={busy} disabled={!complete}>
          <Save className="h-4 w-4" /> {saved ? "Cập nhật đánh giá" : "Lưu đánh giá"}
        </Button>
        {!complete && <p className="text-xs text-slate-500">Chọn đủ mức cho cả {LEADER_RUBRIC.length} tiêu chí để lưu.</p>}
      </div>
    </Card>
  );
}

/** Bảng đánh giá của trưởng nhóm (mẫu "Team leader's assessment") – chỉ trưởng nhóm thấy. */
export default function LeaderAssessmentForm() {
  const { data } = useProject();
  if (!data.me.isLeader) return null;
  const others = data.members.filter((m) => m.id !== data.me.id);
  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
        <ClipboardCheck className="h-5 w-5 text-indigo-600" /> Đánh giá của trưởng nhóm theo bảng tiêu chí
      </h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">
        Phần này <b>không ẩn danh</b> và tách riêng với đánh giá chéo. Chỉ bạn và chính thành viên đó xem được kết quả trong Báo cáo. Có thể cập nhật lại bất cứ lúc nào.
      </p>
      {others.length === 0 ? (
        <p className="text-sm text-slate-500">Nhóm chưa có thành viên nào khác.</p>
      ) : (
        <div className="space-y-4">
          {others.map((m) => (
            <MemberRubric key={m.id} memberId={m.id} name={m.name} />
          ))}
        </div>
      )}
    </section>
  );
}
