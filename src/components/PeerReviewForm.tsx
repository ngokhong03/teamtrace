"use client";

import { useState } from "react";
import { EyeOff, Send } from "lucide-react";
import { Alert, Avatar, Button, Card, StarRating, inputCls } from "./ui";
import { api } from "@/lib/client";
import { useProject } from "./ProjectProvider";

const CRITERIA = [
  { key: "responsibility", label: "Trách nhiệm & đúng hạn", hint: "Làm đủ phần việc, nộp đúng thời gian" },
  { key: "quality", label: "Chất lượng nội dung đóng góp", hint: "Sản phẩm có giá trị, làm kỹ, chính xác" },
  { key: "collaboration", label: "Hỗ trợ & phối hợp nhóm", hint: "Giao tiếp tốt, sẵn sàng giúp đỡ" },
] as const;
type Key = (typeof CRITERIA)[number]["key"];
type Draft = Record<Key, number> & { comment: string };
const BLANK: Draft = { responsibility: 0, quality: 0, collaboration: 0, comment: "" };

export default function PeerReviewForm({ onDone }: { onDone: () => void }) {
  const { code, session, data } = useProject();
  const targets = data.members.filter((m) => m.id !== data.me.id);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(targets.map((t) => [t.id, { responsibility: 0, quality: 0, collaboration: 0, comment: "" }]))
  );
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const complete = (d: Draft) => d.responsibility > 0 && d.quality > 0 && d.collaboration > 0;
  const doneCount = targets.filter((t) => drafts[t.id] && complete(drafts[t.id])).length;
  const allDone = doneCount === targets.length;

  const patch = (id: string, p: Partial<Draft>) => setDrafts((s) => ({ ...s, [id]: { ...(s[id] ?? BLANK), ...p } }));

  async function submit() {
    if (!allDone) return setError("Hãy chấm đủ 3 tiêu chí cho tất cả thành viên.");
    setConfirming(false);
    setBusy(true);
    setError("");
    try {
      await api(`/api/projects/${code}/reviews`, {
        session,
        body: { reviews: targets.map((t) => ({ revieweeId: t.id, ...drafts[t.id] })) },
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">
        <span className="flex gap-2">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Ẩn danh hoàn toàn:</b> hệ thống chỉ ghi nhận “bạn đã nộp”, còn nội dung chấm điểm được lưu <b>không kèm tên người chấm</b>.
            Hãy đánh giá trung thực, dựa trên đóng góp thực tế.
          </span>
        </span>
      </Alert>

      {targets.map((t) => {
        const d = drafts[t.id] ?? BLANK;
        return (
          <Card key={t.id}>
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={t.name} size={40} />
              <div>
                <p className="font-semibold text-slate-900">{t.name}</p>
                <p className="text-xs text-slate-500">{t.studentId}</p>
              </div>
            </div>
            <div className="space-y-4">
              {CRITERIA.map((c) => (
                <div key={c.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{c.label}</p>
                    <p className="text-xs text-slate-500">{c.hint}</p>
                  </div>
                  <StarRating label={`${c.label} – ${t.name}`} value={d[c.key]} onChange={(v) => patch(t.id, { [c.key]: v })} />
                </div>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">Nhận xét (không bắt buộc)</span>
                <textarea
                  className={`${inputCls} min-h-[72px]`}
                  value={d.comment}
                  maxLength={800}
                  onChange={(e) => patch(t.id, { comment: e.target.value })}
                  placeholder="Điểm tốt và điều bạn mong bạn ấy cải thiện – góp ý lịch sự, cụ thể."
                />
              </label>
            </div>
          </Card>
        );
      })}

      {error && <Alert tone="error">{error}</Alert>}
      <div className="sticky bottom-20 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-4">
        <p className="text-sm text-slate-600">
          Đã chấm <b>{doneCount}/{targets.length}</b> thành viên
        </p>
        {!confirming && (
          <Button onClick={() => (allDone ? setConfirming(true) : setError("Hãy chấm đủ 3 tiêu chí cho tất cả thành viên."))} loading={busy} disabled={!allDone}>
            <Send className="h-4 w-4" /> Gửi đánh giá
          </Button>
        )}
      </div>
      {confirming && (
        <div className="sticky bottom-20 rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-lg sm:bottom-4">
          <p className="text-sm font-medium text-amber-900">
            Sau khi gửi, bạn <b>không thể sửa hoặc gửi lại</b>. Đánh giá được lưu ẩn danh. Xác nhận gửi?
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={submit} loading={busy}>
              <Send className="h-4 w-4" /> Xác nhận gửi
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Xem lại
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
