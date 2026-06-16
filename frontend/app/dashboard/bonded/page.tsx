import Link from "next/link";
import KpiCard from "@/app/_components/KpiCard";

type BondedSiteKey = "kix" | "tokyo";

const BONDED_SITES: Record<
  BondedSiteKey,
  { label: string; routeLabel: string; rule: string }
> = {
  kix: {
    label: "関西/関空",
    routeLabel: "KIX",
    rule:
      "BINを保税側実作業の開始点として管理 / 17:30以降は翌日集荷扱い / 24hフリータイム超過は優先アラート",
  },
  tokyo: {
    label: "東京/新木場",
    routeLabel: "TOKYO",
    rule:
      "横持ちとBIN待ちを重点監視 / 当日便接続(17時/18時)を優先 / 長時間滞留は日次レビュー対象",
  },
};

function normalizeSite(site: string | string[] | undefined): BondedSiteKey {
  const value = Array.isArray(site) ? site[0] : site;
  return value === "tokyo" ? "tokyo" : "kix";
}

const KPI_DATA: Record<
  BondedSiteKey,
  {
    pkgPendingOut: number;
    outPendingBin: number;
    binPendingHpk: number;
    permitPendingShipout: number;
    holdCount: number;
    longAgingCount: number;
    hpkRate: number;
    sameDayRate: number;
    terminalOver24h: number;
    costK: number;
  }
> = {
  kix: {
    pkgPendingOut: 24,
    outPendingBin: 17,
    binPendingHpk: 31,
    permitPendingShipout: 19,
    holdCount: 12,
    longAgingCount: 5,
    hpkRate: 93.8,
    sameDayRate: 90.6,
    terminalOver24h: 5,
    costK: 412,
  },
  tokyo: {
    pkgPendingOut: 32,
    outPendingBin: 22,
    binPendingHpk: 44,
    permitPendingShipout: 27,
    holdCount: 16,
    longAgingCount: 9,
    hpkRate: 91.4,
    sameDayRate: 87.9,
    terminalOver24h: 8,
    costK: 536,
  },
};

const PIPELINE_STAGES = [
  { code: "PKG", label: "PKG監視\n(上屋側)" },
  { code: "OUT", label: "OUT\n横持ち" },
  { code: "BIN", label: "BIN登録\n保税開始" },
  { code: "HPK", label: "HPK\n突合" },
  { code: "許可", label: "許可/区分\n分岐" },
  { code: "搬出", label: "搬出\n集荷待ち" },
];

const COUNTS: Record<BondedSiteKey, number[]> = {
  kix: [2100, 2045, 1982, 1860, 1788, 1720],
  tokyo: [2650, 2522, 2411, 2234, 2148, 2055],
};

const DWELL_CHIPS: Record<
  BondedSiteKey,
  Array<{ label: string; count: number; level: "normal" | "warn" | "danger" }>
> = {
  kix: [
    { label: "PKG後OUT未実施", count: 24, level: "warn" },
    { label: "OUT済BIN待ち", count: 17, level: "warn" },
    { label: "BIN済HPK不可", count: 31, level: "danger" },
    { label: "翌日集荷待ち", count: 22, level: "danger" },
  ],
  tokyo: [
    { label: "PKG後OUT未実施", count: 32, level: "warn" },
    { label: "OUT済BIN待ち", count: 22, level: "danger" },
    { label: "BIN済HPK不可", count: 44, level: "danger" },
    { label: "翌日集荷待ち", count: 29, level: "danger" },
  ],
};

const CHIP_COLOR = {
  normal: "bg-yellow-50 border-yellow-300 text-yellow-800",
  warn: "bg-orange-50 border-orange-300 text-orange-800",
  danger: "bg-red-50 border-red-400 text-red-800",
};

export default async function BondedDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string | string[] }>;
}) {
  const sp = await searchParams;
  const siteKey = normalizeSite(sp?.site);
  const site = BONDED_SITES[siteKey];
  const kpi = KPI_DATA[siteKey];
  const counts = COUNTS[siteKey];
  const chips = DWELL_CHIPS[siteKey];
  const summary = {
    smooth: counts[counts.length - 1],
    wait: kpi.pkgPendingOut + kpi.outPendingBin,
    over: kpi.longAgingCount + Math.max(0, kpi.binPendingHpk - 30),
    tmr: kpi.permitPendingShipout,
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#eef4ff] to-[#f4f7fb]">
      <div className="bg-[#111827] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs transition-colors">
            ← 全体
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-bold">保税部ダッシュボード</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 mr-1">拠点</span>
          {Object.entries(BONDED_SITES).map(([key, item]) => (
            <Link
              key={key}
              href={`/dashboard/bonded?site=${key}`}
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
            <h1 className="text-2xl font-black text-[#172033] tracking-tight">保税 横型フローボード</h1>
            <span className="inline-flex items-center rounded-full border border-amber-500 bg-amber-100 px-3 py-0.5 text-[11px] font-extrabold text-amber-700">
              モック寄せ
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            拠点: {site.label} ({site.routeLabel}) 集計日: 2026-06-16 更新: 08:05 JST
          </p>
          <p className="text-xs text-gray-500 mt-1">
            数字が左から右へ流れるパイプライン表示。下チップは滞留、紫は翌日繰越を示します。
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-900 font-medium">
          {site.rule}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border-2 border-emerald-600 bg-emerald-100 px-4 py-3">
            <div className="text-[11px] font-bold text-emerald-800">順流（正常処理）</div>
            <div className="text-3xl font-black text-emerald-900 leading-none mt-1">{summary.smooth.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-700 mt-1">搬出へ接続</div>
          </div>
          <div className="rounded-xl border-2 border-amber-500 bg-amber-100 px-4 py-3">
            <div className="text-[11px] font-bold text-amber-800">要対応（待ち）</div>
            <div className="text-3xl font-black text-amber-900 leading-none mt-1">{summary.wait.toLocaleString()}</div>
            <div className="text-[11px] text-amber-700 mt-1">PKG/OUT周辺</div>
          </div>
          <div className="rounded-xl border-2 border-red-500 bg-red-100 px-4 py-3">
            <div className="text-[11px] font-bold text-red-800">超過・長期滞留</div>
            <div className="text-3xl font-black text-red-900 leading-none mt-1">{summary.over.toLocaleString()}</div>
            <div className="text-[11px] text-red-700 mt-1">優先アラート対象</div>
          </div>
          <div className="rounded-xl border-2 border-violet-500 bg-violet-100 px-4 py-3">
            <div className="text-[11px] font-bold text-violet-800">翌日繰越</div>
            <div className="text-3xl font-black text-violet-900 leading-none mt-1">{summary.tmr.toLocaleString()}</div>
            <div className="text-[11px] text-violet-700 mt-1">次便へ移送</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="PKG済み未OUT" value={kpi.pkgPendingOut} unit="件" status={kpi.pkgPendingOut > 30 ? "warning" : "normal"} />
          <KpiCard label="OUT済み未BIN" value={kpi.outPendingBin} unit="件" status={kpi.outPendingBin > 20 ? "warning" : "normal"} />
          <KpiCard label="BIN済み未HPK" value={kpi.binPendingHpk} unit="件" status={kpi.binPendingHpk > 30 ? "critical" : "warning"} highlight />
          <KpiCard label="許可済み未搬出" value={kpi.permitPendingShipout} unit="件" status={kpi.permitPendingShipout > 20 ? "warning" : "normal"} />
          <KpiCard label="保留ゾーン" value={kpi.holdCount} unit="件" status={kpi.holdCount > 15 ? "warning" : "normal"} />
          <KpiCard label="長期滞留" value={kpi.longAgingCount} unit="件" status={kpi.longAgingCount > 5 ? "critical" : "warning"} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="HPK実行率" value={kpi.hpkRate} unit="%" target="95%" status={kpi.hpkRate >= 95 ? "normal" : "warning"} />
          <KpiCard label="当日処理率" value={kpi.sameDayRate} unit="%" target="90%" status={kpi.sameDayRate >= 90 ? "normal" : "warning"} />
          <KpiCard label="24hフリータイム超過" value={kpi.terminalOver24h} unit="件" status={kpi.terminalOver24h > 5 ? "critical" : "warning"} />
          <KpiCard label="ターミナルコスト" value={kpi.costK} unit="千円" status="normal" />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-x-auto">
          <div className="border-2 border-dashed border-gray-500 bg-gray-100 rounded-xl px-4 py-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
            <span className="bg-gray-600 text-white rounded px-2 py-0.5 font-bold">通関側（前工程・点線）</span>
            <span>データ受領</span><span className="text-gray-400">-&gt;</span>
            <span>HS確認・クレンジング</span><span className="text-gray-400">-&gt;</span>
            <span>E-Naccs投入</span><span className="text-gray-400">-&gt;</span>
            <span className="font-bold text-[#1f4e79]">予備申告 / HPK本申告</span>
          </div>
          <div className="flex justify-center my-1">
            <div className="h-6 border-l-2 border-dashed border-gray-500 relative">
              <span className="absolute left-2 top-1 whitespace-nowrap text-[10px] font-bold text-gray-500">▼ 申告ステータス連携</span>
            </div>
          </div>

          <div className="flex min-w-[1180px] items-start gap-0">
            {PIPELINE_STAGES.map((stage, idx) => (
              <div key={stage.code} className="flex items-start">
                <div className="flex w-[140px] flex-col items-center">
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
            {chips.map((item) => (
              <div key={item.label} className={`rounded-lg border px-3 py-2 ${CHIP_COLOR[item.level]}`}>
                <div className="text-[11px] font-semibold">{item.label}</div>
                <div className="text-xl font-black mt-0.5">{item.count}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl border-2 border-dashed border-violet-500 bg-violet-50 px-4 py-2 text-xs text-violet-900 flex flex-wrap items-center gap-2">
            <span className="bg-violet-600 text-white rounded px-2 py-0.5 font-bold">18時以降（夜間）</span>
            <span>通常搬入・搬出終了</span><span className="text-violet-400">-&gt;</span>
            <span>未許可/保留在庫スキャン</span><span className="text-violet-400">-&gt;</span>
            <span className="font-bold text-green-700">許可検出は翌日便へ復帰</span>
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