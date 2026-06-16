import { pool } from "@/lib/db";
import Link from "next/link";
import KpiCard from "@/app/_components/KpiCard";
import DwellTable, { DwellRow } from "@/app/_components/DwellTable";
import FlowDiagram, { FlowStep } from "@/app/_components/FlowDiagram";

type BondedSiteKey = "kix" | "tokyo";

const BONDED_SITES: Record<BondedSiteKey, { label: string; routeLabel: string; noteLabel: string }> = {
  kix: { label: "関西/関空", routeLabel: "KIX", noteLabel: "KIX 運用注記" },
  tokyo: { label: "東京/新木場", routeLabel: "TOKYO", noteLabel: "東京/新木場 運用注記" },
};

function normalizeBondedSite(site: string | string[] | undefined): BondedSiteKey {
  const value = Array.isArray(site) ? site[0] : site;
  return value === "tokyo" ? "tokyo" : "kix";
}

async function getDwellDefs(category: string) {
  const result = await pool.query(
    `SELECT code, name_ja, exit_condition_text FROM dwell_location_definition
     WHERE category_code = $1 AND is_active = 1 ORDER BY display_order`,
    [category]
  );
  return result.rows as { code: string; name_ja: string; exit_condition_text: string | null }[];
}

const MOCK_KPI = {
  pkgPendingOut: 24,
  outPendingBin: 17,
  binPendingHpk: 31,
  hpkError: 8,
  permitPendingShipout: 19,
  holdCount: 12,
  holdOver7d: 3,
  pickupPendingNextDay: 22,
  terminal24hOver: 5,
  oltToOutHours: 6.2,
  planVsActual: 91.4,
};

const MOCK_DWELL: Record<string, { b24h: number; b48h: number; b1w: number; b2w: number; b4wUnder: number; b4wOver: number }> = {
  BONDED_OUT_PENDING_BIN:         { b24h: 10, b48h: 5, b1w: 2, b2w: 0, b4wUnder: 0, b4wOver: 0 },
  BONDED_PERMIT_PENDING_SHIPOUT:  { b24h: 16, b48h: 2, b1w: 1, b2w: 0, b4wUnder: 0, b4wOver: 0 },
};

const FLOW_STEPS: FlowStep[] = [
  { code: "APK/PKG", name: "PKG確認", dwellCount: MOCK_KPI.pkgPendingOut },
  { code: "OUT",     name: "搬出",    dwellCount: MOCK_KPI.outPendingBin },
  { code: "BIN",     name: "搬入",    dwellCount: MOCK_KPI.binPendingHpk },
  { code: "HPK",     name: "HPK",     dwellCount: MOCK_KPI.hpkError },
  { code: "搬出",    name: "許可後搬出", dwellCount: MOCK_KPI.permitPendingShipout },
];

export default async function BondedDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const siteKey = normalizeBondedSite(resolvedSearchParams?.site);
  const site = BONDED_SITES[siteKey];

  const dwellDefs = await getDwellDefs("BONDED");

  const dwellRows: DwellRow[] = dwellDefs.map((def) => {
    const counts = MOCK_DWELL[def.code] ?? { b24h: 0, b48h: 0, b1w: 0, b2w: 0, b4wUnder: 0, b4wOver: 0 };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { name: def.name_ja, exitCondition: def.exit_condition_text ?? undefined, counts: { total, ...counts } };
  });

  return (
    <div className="min-h-screen">
      {/* トップバー */}
      <div className="bg-gray-900 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← 部門一覧
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-semibold">保税部</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500 mr-1">拠点</span>
          {Object.entries(BONDED_SITES).map(([key, item]) => (
            <Link
              key={key}
              href={`/dashboard/bonded?site=${key}`}
              className={`px-3 py-1.5 rounded-full border transition-colors ${
                siteKey === key
                  ? "bg-white text-gray-900 border-white font-semibold"
                  : "text-gray-300 border-gray-700 hover:border-gray-500 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

    <div className="p-6 space-y-5">
      {/* ヘッダー */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">保税部ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          拠点: {site.label} ({site.routeLabel}) ｜ 集計日: 2026-06-16 ｜ 更新: 07:05 JST
        </p>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard label="PKG済み未OUT"      value={MOCK_KPI.pkgPendingOut}      unit="件" status={MOCK_KPI.pkgPendingOut > 30 ? "warning" : "normal"} />
        <KpiCard label="OUT済み未BIN"       value={MOCK_KPI.outPendingBin}       unit="件" status={MOCK_KPI.outPendingBin > 20 ? "warning" : "normal"} />
        <KpiCard label="BIN済み未HPK"       value={MOCK_KPI.binPendingHpk}       unit="件" status={MOCK_KPI.binPendingHpk > 30 ? "warning" : "normal"} />
        <KpiCard label="HPKエラー件数"      value={MOCK_KPI.hpkError}            unit="件" status={MOCK_KPI.hpkError > 5 ? "warning" : "normal"} />
        <KpiCard label="許可済み未搬出"     value={MOCK_KPI.permitPendingShipout} unit="件" status={MOCK_KPI.permitPendingShipout > 20 ? "warning" : "normal"} />
        <KpiCard label="保留件数"           value={MOCK_KPI.holdCount}           unit="件" status={MOCK_KPI.holdCount > 15 ? "warning" : "normal"} />
      </div>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
        <KpiCard label="保留7日超"          value={MOCK_KPI.holdOver7d}          unit="件" status={MOCK_KPI.holdOver7d > 0 ? "warning" : "normal"} />
        <KpiCard label="翌日集荷待ち"       value={MOCK_KPI.pickupPendingNextDay} unit="件" status="normal" />
        <KpiCard label="ターミナル24h超"     value={MOCK_KPI.terminal24hOver}     unit="件" status={MOCK_KPI.terminal24hOver > 3 ? "warning" : "normal"} />
        <KpiCard label="OLT→OUTリードタイム" value={MOCK_KPI.oltToOutHours}       unit="h" target="8h" status="normal" />
        <KpiCard label="処理能力予実"        value={MOCK_KPI.planVsActual}        unit="%" target="95.0%" status={MOCK_KPI.planVsActual >= 95 ? "normal" : "warning"} />
      </div>

      {/* フロー */}
      <FlowDiagram steps={FLOW_STEPS} />

      {/* 滞留スナップショット */}
      <DwellTable rows={dwellRows} title="フロー滞留スナップショット（現時点）" />

      {/* 保留ゾーン */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          保留ゾーン詳細
          <span className="ml-2 text-xs font-normal text-gray-400">（日次チェック対象）</span>
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-2 text-left font-medium">保留理由</th>
                <th className="px-3 py-2 text-right font-medium">件数</th>
                <th className="px-3 py-2 text-right font-medium">最大経過日数</th>
                <th className="px-4 py-2 text-left font-medium">次アクション</th>
                <th className="px-4 py-2 text-left font-medium">担当</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                { reason: "未申告（書類待ち）", count: 5, maxDays: 4,  action: "通関状況確認", owner: "通関/保税" },
                { reason: "未許可（税関対応中）", count: 4, maxDays: 12, action: "税関回答待ち", owner: "通関士" },
                { reason: "検査指定",           count: 2, maxDays: 3,  action: "検査日程調整", owner: "保税管理者" },
                { reason: "顧客指示待ち",       count: 1, maxDays: 21, action: "CS経由確認",   owner: "CS" },
              ].map((row) => (
                <tr key={row.reason} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{row.reason}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{row.count}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold ${row.maxDays >= 14 ? "text-red-600" : row.maxDays >= 7 ? "text-amber-500" : "text-gray-600"}`}>
                    {row.maxDays}日
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{row.action}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          ※ 21日超は長期滞留アラート対象。1年以上は債権放棄リスクのため保管料確認必須。
        </div>
      </div>

      {/* 拠点差分注記 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <span className="font-semibold">{site.noteLabel}:</span> 15時以降の追加、通関士不在、滅却立会キャパがボトルネックになりやすい。
        ANA/キャセイ等は搬出予約が別途必要。
      </div>
    </div>
    </div>
  );
}
