"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Calculator,
  Check,
  Copy,
  Lightbulb,
  MessageSquareQuote,
  Printer,
  RefreshCw,
  Sparkles,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useProject } from "@/components/ProjectProvider";
import RadarChartCard from "@/components/RadarChartCard";
import { Alert, Avatar, Badge, Button, Card, CopyFallback, PageTitle, ProgressBar, Spinner, copyText, inputCls } from "@/components/ui";
import { api } from "@/lib/client";
import { suggestGrade } from "@/lib/scoring";
import type { MemberReport, ReportResponse } from "@/lib/types";
import { cn, formatDate, fmtNum } from "@/lib/utils";

const scoreColor = (n: number) => (n >= 75 ? "text-emerald-600" : n >= 55 ? "text-amber-600" : "text-rose-600");

function summaryText(r: ReportResponse): string {
  const lines: string[] = [];
  lines.push(`BÁO CÁO ĐÓNG GÓP NHÓM – ${r.project.name}`);
  if (r.project.course) lines.push(`Môn học: ${r.project.course}`);
  if (r.project.deadline) lines.push(`Deadline: ${formatDate(r.project.deadline)}`);
  lines.push(`Ngày xuất: ${new Date(r.generatedAt).toLocaleString("vi-VN")}`);
  lines.push(
    `Công thức: ${r.weights.work * 100}% WorkTrace + ${r.weights.peer * 100}% Peer Review + ${r.weights.ai * 100}% AI`
  );
  lines.push("");
  lines.push(`Tổng quan: ${r.team.progress}`);
  lines.push(`Nhận xét nhóm: ${r.team.summary}`);
  lines.push("");
  lines.push("BẢNG XẾP HẠNG");
  for (const m of r.members) {
    lines.push(
      `${m.rank}. ${m.name} (${m.studentId}) – Điểm: ${m.total}/100 – Tỷ lệ đóng góp: ${m.share}% – ` +
        `WorkTrace ${m.workScore}, Peer ${m.peerScore ?? "n/a"}, AI ${m.aiScore} – ${m.stats.hours} giờ, ${m.stats.logCount} đầu việc`
    );
  }
  lines.push("");
  lines.push("NHẬN XÉT TỪNG THÀNH VIÊN");
  for (const m of r.members) {
    lines.push(`• ${m.name}: ${m.insight.comment}`);
    m.insight.strengths.forEach((s) => lines.push(`   + ${s}`));
    m.insight.improvements.forEach((s) => lines.push(`   - Cần cải thiện: ${s}`));
    m.flags.forEach((s) => lines.push(`   ! ${s}`));
  }
  if (r.warnings.length) {
    lines.push("");
    lines.push("LƯU Ý");
    r.warnings.forEach((w) => lines.push(`- ${w}`));
  }
  lines.push("");
  lines.push("Báo cáo do TeamTrace tạo tự động; điểm số mang tính tham khảo, quyết định cuối cùng thuộc về giảng viên.");
  return lines.join("\n");
}

export default function ReportPage() {
  const { code, session, data } = useProject();
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(data.me.id);
  const [grade, setGrade] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await api<ReportResponse>(`/api/projects/${code}/report`, { session }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được báo cáo");
    } finally {
      setLoading(false);
    }
  }, [code, session]);

  useEffect(() => {
    load();
  }, [load]);

  const current: MemberReport | undefined = useMemo(
    () => report?.members.find((m) => m.id === selected) ?? report?.members[0],
    [report, selected]
  );

  async function runAi() {
    setAiBusy(true);
    setAiMsg(null);
    try {
      await api(`/api/projects/${code}/analyze`, { session, method: "POST", body: {} });
      setAiMsg({ tone: "success", text: "Đã phân tích xong bằng Claude." });
      await load();
    } catch (e) {
      setAiMsg({ tone: "error", text: e instanceof Error ? e.message : "Không chạy được phân tích AI" });
    } finally {
      setAiBusy(false);
    }
  }

  async function copy() {
    if (!report) return;
    const text = summaryText(report);
    if (await copyText(text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setFallback(text);
    }
  }

  if (loading && !report) return <Spinner label="Đang tính điểm đóng góp…" />;
  if (error && !report) return <Alert tone="error">{error}</Alert>;
  if (!report || !current) return null;

  const g = Number(grade);
  const gradeOk = grade !== "" && Number.isFinite(g) && g >= 0 && g <= 10;

  return (
    <>
      {/* Tiêu đề khi in */}
      <div className="hidden print:mb-4 print:block">
        <h1 className="text-2xl font-bold">Báo cáo đóng góp nhóm – {report.project.name}</h1>
        <p className="text-sm text-slate-600">
          {report.project.course && `${report.project.course} · `}
          {report.project.deadline && `Deadline ${formatDate(report.project.deadline)} · `}
          Xuất ngày {new Date(report.generatedAt).toLocaleDateString("vi-VN")}
        </p>
      </div>

      <div className="no-print">
        <PageTitle
          title="Báo cáo đóng góp"
          desc={`Contribution Score = ${report.weights.work * 100}% WorkTrace + ${report.weights.peer * 100}% Peer Review + ${report.weights.ai * 100}% AI.`}
          right={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={load} loading={loading}>
                <RefreshCw className="h-4 w-4" /> Làm mới
              </Button>
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Đã sao chép" : "Sao chép tóm tắt"}
              </Button>
              <Button size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> In / Lưu PDF
              </Button>
            </div>
          }
        />
      </div>

      {fallback && (
        <div className="mb-4">
          <CopyFallback text={fallback} onClose={() => setFallback(null)} />
        </div>
      )}

      {report.warnings.length > 0 && (
        <div className="mb-4 space-y-2">
          {report.warnings.map((w) => (
            <Alert key={w} tone="warn">
              <span className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {w}
              </span>
            </Alert>
          ))}
        </div>
      )}

      {/* Tóm tắt nhóm + AI */}
      <Card className="print-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles className="h-5 w-5 text-indigo-500" /> AI Insights – Tóm tắt nhóm
          </h2>
          <div className="no-print flex flex-wrap items-center gap-2">
            <Badge tone={report.ai.source === "claude" ? "indigo" : "slate"}>
              <Bot className="h-3 w-3" />
              {report.ai.source === "claude" ? `Claude${report.ai.model ? ` (${report.ai.model})` : ""}` : "Phân tích tự động (heuristic)"}
            </Badge>
            {report.ai.stale && <Badge tone="amber">Dữ liệu đã thay đổi – nên chạy lại</Badge>}
            {report.ai.available && data.me.isLeader && (
              <Button size="sm" variant="secondary" onClick={runAi} loading={aiBusy}>
                <Sparkles className="h-4 w-4" /> Phân tích bằng Claude
              </Button>
            )}
          </div>
        </div>
        {aiMsg && (
          <div className="mb-3 no-print">
            <Alert tone={aiMsg.tone}>{aiMsg.text}</Alert>
          </div>
        )}
        <p className="text-sm text-slate-700">{report.team.progress}</p>
        <p className="mt-2 text-sm text-slate-700">{report.team.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Thành viên", String(report.team.memberCount)],
            ["Đầu việc", String(report.team.logCount)],
            ["Tổng giờ", fmtNum(report.team.totalHours)],
            ["Đã nộp đánh giá", `${report.team.submittedCount}/${report.team.memberCount}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{k}</p>
              <p className="text-lg font-bold text-slate-900">{v}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Bảng xếp hạng */}
      <Card className="print-card mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <Trophy className="h-5 w-5 text-amber-500" /> Bảng xếp hạng & tỷ lệ đóng góp đề xuất
          </h2>
          <div className="no-print flex items-center gap-2">
            <Calculator className="h-4 w-4 text-slate-400" />
            <input
              className={cn(inputCls, "!w-36 !py-1.5")}
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Điểm nhóm (0–10)"
              aria-label="Điểm cả nhóm để tính điểm cá nhân đề xuất"
            />
          </div>
        </div>
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 sm:px-2">#</th>
                <th className="px-2 py-2">Thành viên</th>
                <th className="px-2 py-2 text-right">WorkTrace</th>
                <th className="px-2 py-2 text-right">Peer</th>
                <th className="px-2 py-2 text-right">AI</th>
                <th className="px-2 py-2 text-right">Điểm</th>
                <th className="w-40 px-2 py-2">% đóng góp</th>
                {gradeOk && <th className="px-2 py-2 text-right">Điểm đề xuất</th>}
              </tr>
            </thead>
            <tbody>
              {report.members.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setSelected(m.id)}
                  className={cn(
                    "cursor-pointer border-b border-slate-100 transition hover:bg-slate-50",
                    m.id === current.id && "bg-indigo-50/60"
                  )}
                >
                  <td className="px-4 py-3 font-bold text-slate-500 sm:px-2">{m.rank}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={m.name} size={30} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {m.name} {m.id === report.me.id && <span className="text-slate-400">(bạn)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{m.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{Math.round(m.workScore)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{m.peerScore === null ? "—" : Math.round(m.peerScore)}</td>
                  <td className="px-2 py-3 text-right tabular-nums">{Math.round(m.aiScore)}</td>
                  <td className={cn("px-2 py-3 text-right text-base font-bold tabular-nums", scoreColor(m.total))}>
                    {Math.round(m.total)}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={m.share} className="flex-1" />
                      <span className="w-12 text-right text-xs font-semibold tabular-nums text-slate-700">{m.share}%</span>
                    </div>
                  </td>
                  {gradeOk && (
                    <td className="px-2 py-3 text-right font-semibold tabular-nums">
                      {suggestGrade(g, m.share, report.team.memberCount)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Điểm Peer được điều chỉnh theo minh chứng: người gần như không có minh chứng trên WorkTrace chỉ được tính tối đa 20% điểm Peer, để đánh giá nể nang không che lấp việc không làm.
        </p>
        {gradeOk && (
          <p className="mt-2 text-xs text-slate-500">
            Điểm đề xuất = điểm nhóm × (tỷ lệ đóng góp × số thành viên), giới hạn trong khoảng 0,5–1,15 lần điểm nhóm và tối đa 10. Chỉ mang tính tham khảo.
          </p>
        )}
      </Card>

      {/* Radar + chi tiết cá nhân */}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="print-card lg:col-span-3">
          <div className="no-print mb-2 flex flex-wrap gap-1.5">
            {report.members.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelected(m.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  m.id === current.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
          <h2 className="font-semibold text-slate-900">Biểu đồ 5 năng lực – {current.name}</h2>
          <RadarChartCard name={current.name} radar={current.radar} teamRadar={report.teamRadar} />
        </Card>

        <Card className="print-card lg:col-span-2">
          <div className="flex items-center gap-3">
            <Avatar name={current.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-900">{current.name}</p>
              <p className="text-xs text-slate-500">Hạng {current.rank}/{report.team.memberCount}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-3xl font-extrabold tabular-nums", scoreColor(current.total))}>{Math.round(current.total)}</p>
              <p className="text-xs text-slate-500">/ 100</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {[
              ["Số giờ", `${fmtNum(current.stats.hours)}h`],
              ["Đầu việc", String(current.stats.logCount)],
              ["Hoàn thành TB", `${current.stats.avgPercent}%`],
              ["Có minh chứng", `${current.stats.evidenceRate}%`],
              ["Ngày hoạt động", String(current.stats.activeDays)],
              ["Lượt được đánh giá", String(current.stats.reviewCount)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 pb-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
          {current.stats.peerAvg && (
            <p className="mt-3 text-xs text-slate-500">
              Đồng đội chấm TB: trách nhiệm {current.stats.peerAvg.responsibility}/5 · chất lượng {current.stats.peerAvg.quality}/5 · phối hợp{" "}
              {current.stats.peerAvg.collaboration}/5
            </p>
          )}
          {current.flags.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {current.flags.map((f) => (
                <li key={f} className="flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Nhận xét ẩn danh nhận được (chỉ của chính mình) */}
      {current.id === report.me.id && (
        <Card className="no-print mt-4">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <MessageSquareQuote className="h-5 w-5 text-indigo-500" /> Nhận xét ẩn danh bạn nhận được
          </h2>
          {current.comments && current.comments.length ? (
            <ul className="space-y-2">
              {current.comments.map((c, i) => (
                <li key={i} className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
                  “{c}”
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Chưa có nhận xét bằng văn bản nào. Nhận xét chỉ hiển thị cho chính người được nhận xét.</p>
          )}
        </Card>
      )}

      {/* Nhận xét AI từng thành viên */}
      <h2 className="mb-3 mt-8 text-lg font-bold text-slate-900">Nhận xét & gợi ý cải thiện từng thành viên</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {report.members.map((m) => (
          <Card key={m.id} className="print-card">
            <div className="mb-2 flex items-center gap-2.5">
              <Avatar name={m.name} size={32} />
              <p className="flex-1 font-semibold text-slate-900">{m.name}</p>
              <Badge tone="indigo">{m.share}%</Badge>
            </div>
            <p className="mb-3 text-sm text-slate-600">{m.insight.comment}</p>
            {m.insight.strengths.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  <ThumbsUp className="h-3.5 w-3.5" /> Điểm mạnh
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {m.insight.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {m.insight.improvements.length > 0 && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                  <Lightbulb className="h-3.5 w-3.5" /> Cần cải thiện
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {m.insight.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        Điểm số do TeamTrace tính từ minh chứng công việc, đánh giá chéo và phân tích AI; mang tính tham khảo, quyết định cuối cùng thuộc về giảng viên.
      </p>
    </>
  );
}
