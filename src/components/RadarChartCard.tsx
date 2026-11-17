"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { RADAR_KEYS, RADAR_LABELS, type RadarKey } from "@/lib/types";

/** Nhãn trục xuống dòng để không bị cắt ở mép trên màn hình hẹp (điện thoại). */
function AxisTick(props: { x?: number; y?: number; textAnchor?: "start" | "middle" | "end" | "inherit"; payload?: { value: string } }) {
  const { x = 0, y = 0, textAnchor, payload } = props;
  const words = String(payload?.value ?? "").split(" ");
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= 9) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  return (
    <text x={x} y={y - (lines.length - 1) * 6} textAnchor={textAnchor} fill="#334155" fontSize={12}>
      {lines.map((ln, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>
          {ln}
        </tspan>
      ))}
    </text>
  );
}

export default function RadarChartCard({
  name,
  radar,
  teamRadar,
}: {
  name: string;
  radar: Record<RadarKey, number>;
  teamRadar: Record<RadarKey, number>;
}) {
  const data = RADAR_KEYS.map((k) => ({ axis: RADAR_LABELS[k], member: radar[k], team: teamRadar[k] }));
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="62%" margin={{ top: 16, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="axis" tick={<AxisTick />} />
          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} angle={90} tickCount={5} />
          <Radar name="Trung bình nhóm" dataKey="team" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeDasharray="4 3" />
          <Radar name={name} dataKey="member" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} strokeWidth={2} />
          <Tooltip formatter={(v: number) => Math.round(v)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
