"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { ADS, PLAN } from "@/lib/ads";

const KEY = "teamtrace.ad.dismissed";

/** Khối quảng cáo cho gói Free. Có nhãn "Quảng cáo", người dùng có thể ẩn trong phiên hiện tại. */
export default function AdSlot({ index = 0 }: { index?: number }) {
  const ad = ADS.length ? ADS[index % ADS.length] : null;
  const [hidden, setHidden] = useState(true); // ẩn khi render server để tránh nháy

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(`${KEY}.${ad?.id}`) === "1");
    } catch {
      setHidden(false);
    }
  }, [ad?.id]);

  if (PLAN !== "free" || !ad || hidden) return null;

  function dismiss() {
    setHidden(true);
    try {
      sessionStorage.setItem(`${KEY}.${ad!.id}`, "1");
    } catch {
      /* bỏ qua */
    }
  }

  return (
    <aside aria-label="Quảng cáo" className="no-print relative rounded-2xl border border-dashed border-slate-300 bg-white p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Quảng cáo
        </span>
        <button
          onClick={dismiss}
          aria-label="Ẩn quảng cáo này"
          title="Ẩn quảng cáo này"
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs font-medium text-indigo-600">{ad.label}</p>
      <h3 className="mt-0.5 font-bold text-slate-900">{ad.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{ad.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ad.tags.map((t) => (
          <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {t}
          </span>
        ))}
      </div>
      <a
        href={ad.url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:border-indigo-300 hover:bg-indigo-50"
      >
        {ad.cta} <ExternalLink className="h-4 w-4" />
      </a>
    </aside>
  );
}
