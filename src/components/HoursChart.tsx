"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface HoursDatum {
  name: string;
  hours: number;
  effective: number;
}

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316"];

export default function HoursChart({ data }: { data: HoursDatum[] }) {
  const height = Math.max(160, data.length * 44 + 30);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} unit="h" allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12, fill: "#334155" }} />
          <Tooltip
            formatter={(v: number) => [`${v} giờ`, "Giờ quy đổi"]}
            labelFormatter={(l) => String(l)}
            cursor={{ fill: "#f1f5f9" }}
          />
          <Bar dataKey="effective" radius={[0, 6, 6, 0]} barSize={22}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
