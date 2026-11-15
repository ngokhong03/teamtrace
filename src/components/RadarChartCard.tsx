"use client";

import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { RADAR_KEYS, RADAR_LABELS, type RadarKey } from "@/lib/types";

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
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#e2e8f0" />
          <PolarAngleAxis dataKey="axis" tick={{ fontSize: 12, fill: "#334155" }} />
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
