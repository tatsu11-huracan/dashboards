import Link from "next/link";
import KpiCard from "@/app/_components/KpiCard";

type DeliverySiteKey = "kix" | "tokyo";

const DELIVERY_SITES: Record<
  DeliverySiteKey,
  { label: string; routeLabel: string; rule: string }
> = {
  kix: {
    label: "関西/関空",
    routeLabel: "KIX",
    rule:
      "17:00便・18:30便の2波運用 / 仕分け締切超過は翌日繰越 / 持戻りは同日再配可否を即時判定",
  },
  tokyo: {
    label: "東京/新木場",
    routeLabel: "TOKYO",
    rule:
      "午前・午後便で積載率を監視 / 再配達指示は15:30まで同日反映 / 夜間は持戻り最小化優先",
  },
};

function normalizeSite(site: string | string[] | undefined): DeliverySiteKey {
  const value = Array.isArray(site) ? site[0] : site;
  return value === "tokyo" ? "tokyo" : "kix";
}

const KPI_DATA: Record<
  DeliverySiteKey,
  {
    toSort: number;
    sorted: number;
    loading: number;
    onRoute: number;
    delivered: number;
    attempted: number;
    carryOver: number;
    onTimeRate: number;
    reDeliveryRate: number;
    routeCapacity: number;
  }
> = {
  kix: {
    toSort: 1820,
    sorted: 1762,
    loading: 1694,
    onRoute: 1620,
    delivered: 1544,
    attempted: 58,
    carryOver: 31,
    onTimeRate: 94.2,
    reDeliveryRate: 8.7,
    routeCapacity: 88.1,
  },
  tokyo: {
    toSort: 2140,
    sorted: 2055,
    loading: 1978,
    onRoute: 1886,
    delivered: 1772,
    attempted: 92,
    carryOver: 47,
    onTimeRate: 92.6,
    reDeliveryRate: 10.9,
    routeCapacity: 91.3,
  },
};

const PIPELINE_STAGES = [
  { code: "入荷", label: "配送依頼\n入荷" },
  { code: "仕分", label: "仕分け\nルート振分" },
  { code: "積込", label: "積み込み\n出発準備" },
  { code: "配送", label: "配送中\n(ラストマイル)" },
  { code: "完了", label: "配達完了\n実績確定" },
];

const COUNTS: Record<DeliverySiteKey, number[]> = {
  kix: [1820, 1762, 1694, 1620, 1544],
  tokyo: [2140, 2055, 1978, 1886, 1772],
};

const ALERTS: Record<
  DeliverySiteKey,
  Array<{ label: string; count: number; level: "warn" | "danger" | "info" }>
> = {
  kix: [
    { label: "仕分け遅延", count: 22, level: "warn" },
    { label: "積載不足", count: 14, level: "info" },
    { label: "再配達対象", count: 58, level: "danger" },
    { label: "翌日繰越", count: 31, level: "danger" },
  ],
  tokyo: [
    { label: "仕分け遅延", count: 35, level: "warn" },
    { label: "積載不足", count: 20, level: "info" },
    { label: "再配達対象", count: 92, level: "danger" },
    { label: "翌日繰越", count: 47, level: "danger" },
  ],
};

const ALERT_COLOR = {
  info: "bg-sky-50 border-sky-300 text-sky-800",
  warn: "bg-orange-50 border-orange-300 text-orange-800",
  danger: "bg-red-50 border-red-400 text-red-800",
};

export default async function DeliveryDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string | string[] }>;
}) {
  const sp = await searchParams;
  const siteKey = normalizeSite(sp?.site);
  const site = DELIVERY_SITES[siteKey];
  const kpi = KPI_DATA[siteKey];
  const counts = COUNTS[siteKey];
  const alerts = ALERTS[siteKey];
  const summary = {
    smooth: kpi.delivered,
    wait: kpi.attempted,
    over: Math.max(0, kpi.attempted - 50),
    tmr: kpi.carryOver,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] to-[#f4f7fb]">
      <div className="bg-[#111827] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs transition-colors">
            ← 全体
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-bold">配送部ダッシュボード</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 mr-1">拠点</span>
          {Object.entries(DELIVERY_SITES).map(([key, item]) => (
            <Link
              key={key}
              href={`/dashboard/delivery?site=${key}`}
              className={`px-3 py-1 rounded-full border transition-colors ${
                siteKey === key
                  ? "bg-white text-gray-900 border-white font-semibold"
                  : "text-gray-300 border-gray-700 hover:border-gray-400 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4 max-w-[1440px] mx-auto">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#172033] tracking-tight">配送 横型フローボード</h1>
            <span className="inline-flex items-center rounded-full border border-amber-500 bg-amber-100 px-3 py-0.5 text-[11px] font-extrabold text-amber-700">
              モック寄せ
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            拠点: {site.label} ({site.routeLabel}) 集計日: 2026-06-16 更新: 08:05 JST
          </p>
          <p className="text-xs text-gray-500 mt-1">
            左右の流量を可視化し、下チップで滞留・再配達・翌日繰越を把握する構成です。
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-900 font-medium">
          {site.rule}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border-2 border-emerald-600 bg-emerald-100 px-4 py-3">
            <div className="text-[11px] font-bold text-emerald-800">順流（当日完了）</div>
            <div className="text-3xl font-black text-emerald-900 leading-none mt-1">{summary.smooth.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-700 mt-1">配達完了</div>
          </div>
          <div className="rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3">
            <div className="text-[11px] font-bold text-amber-800">要対応（再配達）</div>
            <div className="text-3xl font-black text-amber-900 leading-none mt-1">{summary.wait.toLocaleString()}</div>
            <div className="text-[11px] text-amber-700 mt-1">当日リカバリ候補</div>
          </div>
          <div className="rounded-xl border-2 border-red-500 bg-red-100 px-4 py-3">
            <div className="text-[11px] font-bold text-red-800">超過アラート</div>
            <div className="text-3xl font-black text-red-900 leading-none mt-1">{summary.over.toLocaleString()}</div>
            <div className="text-[11px] text-red-700 mt-1">監視閾値超過</div>
          </div>
          <div className="rounded-xl border-2 border-violet-500 bg-violet-100 px-4 py-3">
            <div className="text-[11px] font-bold text-violet-800">翌日繰越</div>
            <div className="text-3xl font-black text-violet-900 leading-none mt-1">{summary.tmr.toLocaleString()}</div>
            <div className="text-[11px] text-violet-700 mt-1">翌日便で処理</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <KpiCard label="仕分け対象" value={kpi.toSort} unit="件" status="normal" />
          <KpiCard label="仕分け完了" value={kpi.sorted} unit="件" status="normal" />
          <KpiCard label="積込完了" value={kpi.loading} unit="件" status="normal" />
          <KpiCard label="配送中" value={kpi.onRoute} unit="件" status="normal" />
          <KpiCard label="配達完了" value={kpi.delivered} unit="件" status="normal" />
          <KpiCard label="再配達対象" value={kpi.attempted} unit="件" status={kpi.attempted > 80 ? "critical" : "warning"} highlight />
          <KpiCard label="翌日繰越" value={kpi.carryOver} unit="件" status={kpi.carryOver > 40 ? "critical" : "warning"} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="時間内完了率" value={kpi.onTimeRate} unit="%" target="94%" status={kpi.onTimeRate >= 94 ? "normal" : "warning"} />
          <KpiCard label="再配達率" value={kpi.reDeliveryRate} unit="%" target="9%" status={kpi.reDeliveryRate <= 9 ? "normal" : "warning"} />
          <KpiCard label="積載率" value={kpi.routeCapacity} unit="%" target="90%" status={kpi.routeCapacity >= 90 ? "normal" : "warning"} />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-x-auto">
          <div className="border-2 border-dashed border-gray-500 bg-gray-100 rounded-xl px-4 py-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <span className="bg-gray-600 text-white rounded px-2 py-0.5 font-bold">保税側（前工程・点線）</span>
            <span>許可確認</span><span className="text-gray-400">-&gt;</span>
            <span>搬出スキャン</span><span className="text-gray-400">-&gt;</span>
            <span>業者別仕分け</span><span className="text-gray-400">-&gt;</span>
            <span className="font-bold text-[#1f4e79]">集荷・引渡し</span>
          </div>
          <div className="flex justify-center my-1">
            <div className="h-6 border-l-2 border-dashed border-gray-500 relative">
              <span className="absolute left-2 top-1 whitespace-nowrap text-[10px] font-bold text-gray-500">▼ 前工程からの引渡し連携</span>
            </div>
          </div>

          <div className="flex min-w-[980px] items-start gap-0">
            {PIPELINE_STAGES.map((stage, idx) => (
              <div key={stage.code} className="flex items-start">
                <div className="flex w-[152px] flex-col items-center">
                  <div className="w-full bg-[#dbe9f9] border-[1.5px] border-[#1f4e79] rounded-xl p-2 text-center min-h-[86px]">
                    <div className="text-[11px] font-black text-[#1f4e79] leading-tight whitespace-pre-line">{stage.label}</div>
                    <div className="text-2xl font-black tabular-nums mt-1">{counts[idx].toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">件</div>
                  </div>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="flex w-[72px] flex-shrink-0 flex-col items-center pt-7">
                    <div className="text-[11px] font-bold text-blue-600 mb-1 whitespace-nowrap">
                      {(counts[idx] - counts[idx + 1]).toLocaleString()}
                    </div>
                    <div className="h-2.5 w-full rounded bg-[repeating-linear-gradient(90deg,#2563eb_0_8px,#bfdbfe_8px_16px)] [background-size:16px_100%]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {alerts.map((item) => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 ${ALERT_COLOR[item.level]}`}>
                <div className="text-[11px] font-semibold">{item.label}</div>
                <div className="text-xl font-black mt-0.5">{item.count}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2 rounded bg-[#dbe9f9] border border-[#1f4e79]" />通常工程</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2 rounded bg-orange-100 border border-orange-400" />滞留</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2 rounded bg-red-100 border border-red-500" />超過</span>
            <span className="flex items-center gap-1"><span className="inline-block w-4 h-2 rounded bg-violet-100 border border-violet-500" />翌日繰越</span>
          </div>
        </div>
      </div>
    </div>
  );
}