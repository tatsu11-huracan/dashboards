import Link from "next/link";
import type { ReactNode } from "react";

type SiteLink = {
  key: string;
  label: string;
  href: string;
};

type SummaryTone = "emerald" | "amber" | "red" | "violet";

type SummaryCard = {
  title: string;
  value: string | number;
  subtext: string;
  tone: SummaryTone;
};

type MetricStatus = "normal" | "warning" | "critical";

type MetricCard = {
  label: string;
  value: string | number;
  unit?: string;
  target?: string | number;
  status?: MetricStatus;
  highlight?: boolean;
};

type ReferenceLane = {
  label: string;
  items: string[];
  suffix?: string;
};

type StageChip = {
  label: string;
  value: string | number;
  tone: "info" | "warn" | "danger" | "tmr";
  note?: string;
};

type FlowStage = {
  code: string;
  label: string;
  value: string | number;
  unit?: string;
  chips?: StageChip[];
};

type LegendItem = {
  label: string;
  tone: "base" | "warn" | "danger" | "tmr";
};

type FlowDashboardProps = {
  title: string;
  titleBadge: string;
  subtitle: string;
  siteLabel: string;
  siteCode: string;
  siteLinks: SiteLink[];
  rule: string;
  summaryCards: SummaryCard[];
  metricRows: MetricCard[][];
  referenceLanes?: ReferenceLane[];
  pipelineCaption?: string;
  stages: FlowStage[];
  legend?: LegendItem[];
  footerNote?: string;
  afterPipeline?: ReactNode;
};

const summaryToneClass: Record<SummaryTone, string> = {
  emerald: "border-emerald-600 bg-emerald-100 text-emerald-900",
  amber: "border-amber-500 bg-amber-100 text-amber-900",
  red: "border-red-500 bg-red-100 text-red-900",
  violet: "border-violet-500 bg-violet-100 text-violet-900",
};

const metricStatusClass: Record<MetricStatus, string> = {
  normal: "border-blue-500",
  warning: "border-amber-400",
  critical: "border-red-500",
};

const chipToneClass: Record<StageChip["tone"], string> = {
  info: "border-sky-300 bg-sky-50 text-sky-800",
  warn: "border-orange-300 bg-orange-50 text-orange-800",
  danger: "border-red-400 bg-red-50 text-red-800",
  tmr: "border-violet-400 bg-violet-50 text-violet-800",
};

const legendToneClass: Record<LegendItem["tone"], string> = {
  base: "bg-[#dbe9f9] border-[#1f4e79]",
  warn: "bg-orange-100 border-orange-400",
  danger: "bg-red-100 border-red-500",
  tmr: "bg-violet-100 border-violet-400",
};

function formatValue(value: string | number): string {
  return typeof value === "number" ? value.toLocaleString() : value;
}

function metricGridClass(length: number): string {
  if (length === 3) return "grid-cols-3";
  if (length === 4) return "grid-cols-2 md:grid-cols-4";
  if (length === 6) return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
  if (length === 7) return "grid-cols-2 md:grid-cols-4 lg:grid-cols-7";
  return "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
}

export default function FlowDashboard({
  title,
  titleBadge,
  subtitle,
  siteLabel,
  siteCode,
  siteLinks,
  rule,
  summaryCards,
  metricRows,
  referenceLanes,
  pipelineCaption,
  stages,
  legend,
  footerNote,
  afterPipeline,
}: FlowDashboardProps) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] to-[#f4f7fb]">
      <div className="flex items-center justify-between bg-[#111827] px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-gray-400 transition-colors hover:text-white">
            ← 全体
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-bold">{title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="mr-1 text-gray-500">拠点</span>
          {siteLinks.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`rounded-full border px-3 py-1 transition-colors ${
                siteCode === item.key
                  ? "border-white bg-white font-semibold text-gray-900"
                  : "border-gray-700 text-gray-300 hover:border-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-4 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-[#172033]">{title}</h1>
            <span className="inline-flex items-center rounded-full border border-amber-500 bg-amber-100 px-3 py-0.5 text-[11px] font-extrabold text-amber-700">
              {titleBadge}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">拠点: {siteLabel} ({siteCode})　{subtitle}</p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-900">
          {rule}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.title} className={`rounded-xl border-2 px-4 py-3 ${summaryToneClass[card.tone]}`}>
              <div className="text-[11px] font-bold">{card.title}</div>
              <div className="mt-1 text-3xl font-black leading-none">{formatValue(card.value)}</div>
              <div className="mt-1 text-[11px] opacity-80">{card.subtext}</div>
            </div>
          ))}
        </div>

        {metricRows.map((row, rowIndex) => (
          <div key={`metric-row-${rowIndex}`} className={`grid gap-3 ${metricGridClass(row.length)}`}>
            {row.map((metric) => (
              <div
                key={metric.label}
                className={`rounded-lg border bg-white p-4 shadow-sm ${metricStatusClass[metric.status ?? "normal"]} ${metric.highlight ? "ring-2 ring-blue-400" : ""}`}
              >
                <span className="text-xs font-medium text-gray-500 truncate">{metric.label}</span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-gray-900">{formatValue(metric.value)}</span>
                  {metric.unit && <span className="text-sm text-gray-500">{metric.unit}</span>}
                </div>
                {metric.target !== undefined && (
                  <span className="text-xs text-gray-400">目標: {formatValue(metric.target)}{metric.unit}</span>
                )}
              </div>
            ))}
          </div>
        ))}

        {referenceLanes && referenceLanes.length > 0 && (
          <>
            {referenceLanes.map((lane) => (
              <div key={lane.label} className="rounded-xl border-2 border-dashed border-gray-500 bg-gray-100 px-4 py-2 text-xs text-gray-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gray-600 px-2 py-0.5 font-bold text-white">{lane.label}</span>
                  {lane.items.map((item, index) => (
                    <span key={item} className="flex items-center gap-2 font-semibold">
                      {item}
                      {index < lane.items.length - 1 && <span className="text-gray-400">-&gt;</span>}
                    </span>
                  ))}
                  {lane.suffix && <span className="font-bold text-[#1f4e79]">{lane.suffix}</span>}
                </div>
              </div>
            ))}
            <div className="flex justify-center">
              <div className="relative h-6 w-px border-l-2 border-dashed border-gray-500">
                <span className="absolute left-2 top-1 whitespace-nowrap text-[10px] font-bold text-gray-500">▼ 連携ポイント</span>
              </div>
            </div>
          </>
        )}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white p-4">
          {pipelineCaption && (
            <div className="mb-3 rounded-xl border-2 border-dashed border-gray-500 bg-gray-100 px-4 py-2 text-xs text-gray-700">
              {pipelineCaption}
            </div>
          )}

          <div className="flex min-w-[980px] items-start gap-0">
            {stages.map((stage, index) => {
              const nextStage = stages[index + 1];
              const connectorValue = nextStage ? Number(stage.value) - Number(nextStage.value) : 0;

              return (
                <div key={stage.code} className="flex items-start">
                  <div className="flex w-[152px] flex-col items-center">
                    <div className="w-full rounded-xl border-[1.5px] border-[#1f4e79] bg-[#dbe9f9] p-2 text-center min-h-[86px]">
                      <div className="whitespace-pre-line text-[11px] font-black leading-tight text-[#1f4e79]">{stage.label}</div>
                      <div className="mt-1 text-2xl font-black tabular-nums">{formatValue(stage.value)}</div>
                      <div className="text-[10px] text-gray-500">{stage.unit ?? "件"}</div>
                    </div>

                    {stage.chips && stage.chips.length > 0 && (
                      <div className="mt-2 flex w-full flex-col gap-1">
                        <div className="self-center h-2.5 border-l-2 border-dotted border-amber-500" />
                        {stage.chips.map((chip) => (
                          <div key={chip.label} className={`rounded-lg border px-2 py-1 text-center text-[10px] font-bold ${chipToneClass[chip.tone]}`}>
                            <div className="text-base font-black leading-none tabular-nums">
                              {formatValue(chip.value)}<span className="text-[10px]">件</span>
                            </div>
                            <div>{chip.label}</div>
                            {chip.note && <div className="mt-0.5 text-green-700">{chip.note}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {index < stages.length - 1 && nextStage && (
                    <div className="flex w-[72px] flex-shrink-0 flex-col items-center pt-7">
                      <div className="mb-1 whitespace-nowrap text-[11px] font-bold text-blue-600">
                        {connectorValue.toLocaleString()}
                      </div>
                      <div className="h-2.5 w-full rounded bg-[repeating-linear-gradient(90deg,#2563eb_0_8px,#bfdbfe_8px_16px)] [background-size:16px_100%]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {afterPipeline}

          {legend && legend.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-gray-500">
              {legend.map((item) => (
                <span key={item.label} className="flex items-center gap-1">
                  <span className={`inline-block h-3 w-5 rounded border ${legendToneClass[item.tone]}`} />
                  {item.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {footerNote && <div className="text-[10px] text-gray-400">{footerNote}</div>}
      </div>
    </div>
  );
}