import { pool } from "@/lib/db";
import Link from "next/link";
import KpiCard from "@/app/_components/KpiCard";
import DwellTable, { DwellRow } from "@/app/_components/DwellTable";
import FlowDiagram, { FlowStep } from "@/app/_components/FlowDiagram";

type CustomsSiteKey = "kix" | "nrt";

const CUSTOMS_SITES: Record<CustomsSiteKey, { label: string; locationCode: string; routeLabel: string }> = {
  kix: { label: "関西/関空", locationCode: "KIX", routeLabel: "KIX" },
  nrt: { label: "関東/成田", locationCode: "NRT", routeLabel: "NRT" },
};

function normalizeCustomsSite(site: string | string[] | undefined): CustomsSiteKey {
  const value = Array.isArray(site) ? site[0] : site;
  return value === "nrt" ? "nrt" : "kix";
}

// ── DB から取得するマスターデータ ─────────────────────────
async function getLocationRules(locationCode: string) {
  const result = await pool.query(
    `SELECT rule_key, rule_value, rule_description, rule_type
     FROM business_location_rule
     WHERE tenant_id = 'ESP3'
       AND business_location_code = $1
       AND is_displayed_on_dashboard = 1
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY display_order`,
    [locationCode]
  );
  return result.rows as {
    rule_key: string;
    rule_value: string;
    rule_description: string;
    rule_type: string;
  }[];
}

async function getDwellLocationDefs(categoryCode: string) {
  const result = await pool.query(
    `SELECT code, name_ja, exit_condition_text, escalation_after_hours
     FROM dwell_location_definition
     WHERE category_code = $1 AND is_active = 1
     ORDER BY display_order`,
    [categoryCode]
  );
  return result.rows as {
    code: string;
    name_ja: string;
    exit_condition_text: string | null;
    escalation_after_hours: number | null;
  }[];
}

// ── モックの実績値（実データ投入後は kpi_actual / stage_dwell_snapshot に置き換え）
const MOCK_KPI = {
  received: 2847,
  cleansed: 2612,
  declared: 2456,
  permitted: 2389,
  permitRate: 97.2,
  dailyProcessRate: 84.1,
  kubun1: 2256,
  kubun2: 89,
  kubun3: 44,
  binHitRate: 88.7,
  receiveToPermitHours: 8.4,
  personnelCostForecast: 612,
  unitCostPerPermit: 256,
  unitCostTarget: 280,
  terminatedCount: 12,
  staffCustoms: 6,
  staffProcessing: 9,
};

const MOCK_DWELL: Record<string, { b24h: number; b48h: number; b1w: number; b2w: number; b4wUnder: number; b4wOver: number }> = {
  CUSTOMS_PRE_CLEANSING:          { b24h: 18, b48h: 9,  b1w: 5,  b2w: 0, b4wUnder: 0, b4wOver: 0 },
  CUSTOMS_NACCS_PREP:             { b24h: 12, b48h: 4,  b1w: 2,  b2w: 0, b4wUnder: 0, b4wOver: 0 },
  CUSTOMS_FAIL_INVENTORY:         { b24h: 8,  b48h: 11, b1w: 12, b2w: 7, b4wUnder: 6, b4wOver: 3 },
  CUSTOMS_PERMIT_PENDING_SHIPOUT: { b24h: 14, b48h: 1,  b1w: 0,  b2w: 0, b4wUnder: 0, b4wOver: 0 },
  CUSTOMS_UNFILED:                { b24h: 20, b48h: 6,  b1w: 2,  b2w: 0, b4wUnder: 0, b4wOver: 0 },
  CUSTOMS_REVIEW_KUBUN23:         { b24h: 5,  b48h: 6,  b1w: 8,  b2w: 3, b4wUnder: 1, b4wOver: 0 },
};

// 申告不備在庫 ヒートマップ（分類 × 時間バケット）
const FAIL_INVENTORY_HEATMAP = [
  { label: "前処理中",      b24h: 3, b48h: 5, b1w: 3, b2w: 1, b4wUnder: 0, b4wOver: 0 },
  { label: "PFチェック中",  b24h: 2, b48h: 3, b1w: 4, b2w: 2, b4wUnder: 2, b4wOver: 1 },
  { label: "書類準備中",    b24h: 3, b48h: 3, b1w: 5, b2w: 4, b4wUnder: 4, b4wOver: 2 },
  { label: "申告不可",      b24h: 0, b48h: 0, b1w: 0, b2w: 0, b4wUnder: 0, b4wOver: 0 },
];

// 通関フロー各ノードの滞留数
const FLOW_STEPS: FlowStep[] = [
  { code: "C-01", name: "受領",      dwellCount: 0 },
  { code: "C-06", name: "クレンジング", dwellCount: 32 },
  { code: "C-07", name: "NACCS準備", dwellCount: 18 },
  { code: "C-08", name: "申告",      dwellCount: 28 },
  { code: "C-09", name: "審査待ち",  dwellCount: 23 },
  { code: "C-10", name: "許可",      dwellCount: 15 },
];

const TERMINAL_STEPS = [
  { code: "C-T1", name: "滅却",     count: 3 },
  { code: "C-T2", name: "積戻し",   count: 7 },
  { code: "C-T3", name: "申告撤回", count: 2 },
];

// ── ページコンポーネント ────────────────────────────────
export default async function CustomsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const siteKey = normalizeCustomsSite(resolvedSearchParams?.site);
  const site = CUSTOMS_SITES[siteKey];

  const [locationRules, dwellDefs] = await Promise.all([
    getLocationRules(site.locationCode),
    getDwellLocationDefs("CUSTOMS"),
  ]);

  // 滞留テーブル行を DB マスター + モック実績値で構築
  const dwellRows: DwellRow[] = dwellDefs.map((def) => {
    const counts = MOCK_DWELL[def.code] ?? {
      b24h: 0, b48h: 0, b1w: 0, b2w: 0, b4wUnder: 0, b4wOver: 0,
    };
    const total = counts.b24h + counts.b48h + counts.b1w + counts.b2w + counts.b4wUnder + counts.b4wOver;
    return {
      name: def.name_ja,
      exitCondition: def.exit_condition_text ?? undefined,
      counts: { total, ...counts },
    };
  });

  const totalFailInventory =
    Object.values(MOCK_DWELL.CUSTOMS_FAIL_INVENTORY).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen">
      {/* トップバー */}
      <div className="bg-gray-900 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← 部門一覧
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-semibold">通関部</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-gray-500 mr-1">拠点</span>
          {Object.entries(CUSTOMS_SITES).map(([key, item]) => (
            <Link
              key={key}
              href={`/dashboard/customs?site=${key}`}
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
      {/* ── ヘッダー ── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">通関部ダッシュボード</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            拠点: {site.label} ({site.routeLabel}) ｜ 集計日: 2026-06-16 ｜ 更新: 07:05 JST
          </p>
        </div>
        <div className="flex items-center gap-3 bg-white rounded-lg shadow-sm px-4 py-2">
          <div className="text-center">
            <div className="text-xs text-gray-400">通関士</div>
            <div className="text-lg font-bold text-blue-600">{MOCK_KPI.staffCustoms}名</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-xs text-gray-400">加工</div>
            <div className="text-lg font-bold text-blue-600">{MOCK_KPI.staffProcessing}名</div>
          </div>
          <div className="w-px h-8 bg-gray-200" />
          <div className="text-center">
            <div className="text-xs text-gray-400">人件費速報</div>
            <div className="text-lg font-bold text-gray-800">{MOCK_KPI.personnelCostForecast}千円</div>
          </div>
        </div>
      </div>

      {/* ── 拠点ルールバー ── */}
      {locationRules.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {locationRules.map((rule) => (
            <div
              key={rule.rule_key}
              className="bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 text-xs text-blue-800"
            >
              <span className="font-semibold">{rule.rule_value}</span>
              {rule.rule_description && (
                <span className="text-blue-600 ml-1">— {rule.rule_description}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── KPI カード ── */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard
          label="受領件数"
          value={MOCK_KPI.received}
          unit="件"
          target={2500}
          status="normal"
        />
        <KpiCard
          label="クレンジング完了"
          value={MOCK_KPI.cleansed}
          unit="件"
          sub={`受領比 ${((MOCK_KPI.cleansed / MOCK_KPI.received) * 100).toFixed(1)}%`}
          status="normal"
        />
        <KpiCard
          label="申告件数"
          value={MOCK_KPI.declared}
          unit="件"
          sub={`受領比 ${((MOCK_KPI.declared / MOCK_KPI.received) * 100).toFixed(1)}%`}
          status="normal"
        />
        <KpiCard
          label="許可件数"
          value={MOCK_KPI.permitted}
          unit="件"
          target={2300}
          status="normal"
        />
        <KpiCard
          label="許可率"
          value={MOCK_KPI.permitRate}
          unit="%"
          target="97.0%"
          status={MOCK_KPI.permitRate >= 97.0 ? "normal" : "warning"}
          highlight
        />
        <KpiCard
          label="当日処理率"
          value={MOCK_KPI.dailyProcessRate}
          unit="%"
          target="85.0%"
          status={MOCK_KPI.dailyProcessRate >= 85.0 ? "normal" : "warning"}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard
          label="BIN間に合い率"
          value={MOCK_KPI.binHitRate}
          unit="%"
          target="90.0%"
          status={MOCK_KPI.binHitRate >= 90.0 ? "normal" : "warning"}
        />
        <KpiCard
          label="到着〜許可時間"
          value={MOCK_KPI.receiveToPermitHours}
          unit="h"
          target="10h"
          targetLabel="目標以内"
          status="normal"
        />
        <KpiCard
          label="許可1件単価"
          value={MOCK_KPI.unitCostPerPermit}
          unit="円"
          target={MOCK_KPI.unitCostTarget}
          targetLabel="目標"
          status={MOCK_KPI.unitCostPerPermit <= MOCK_KPI.unitCostTarget ? "normal" : "warning"}
        />
        <KpiCard
          label="区分1件数"
          value={MOCK_KPI.kubun1}
          unit="件"
          sub={`${((MOCK_KPI.kubun1 / MOCK_KPI.permitted) * 100).toFixed(1)}%`}
          status="normal"
        />
        <KpiCard
          label="区分2件数"
          value={MOCK_KPI.kubun2}
          unit="件"
          sub={`${((MOCK_KPI.kubun2 / MOCK_KPI.permitted) * 100).toFixed(1)}%`}
          status={MOCK_KPI.kubun2 > 100 ? "warning" : "normal"}
        />
        <KpiCard
          label="区分3件数"
          value={MOCK_KPI.kubun3}
          unit="件"
          sub={`${((MOCK_KPI.kubun3 / MOCK_KPI.permitted) * 100).toFixed(1)}%`}
          status={MOCK_KPI.kubun3 > 50 ? "warning" : "normal"}
        />
      </div>

      {/* ── フロー滞留 ── */}
      <FlowDiagram steps={FLOW_STEPS} terminalSteps={TERMINAL_STEPS} />

      {/* ── 滞留スナップショット + 申告不備ヒートマップ ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DwellTable rows={dwellRows} title="フロー滞留スナップショット（現時点）" />

        {/* 申告不備在庫 分類×時間 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-800">
              申告不備在庫 — 分類×経過時間
            </h3>
            <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded">
              合計 {totalFailInventory}件
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-4 py-2 text-left font-medium">分類</th>
                  <th className="px-3 py-2 text-right font-medium">24h</th>
                  <th className="px-3 py-2 text-right font-medium">48h</th>
                  <th className="px-3 py-2 text-right font-medium">1週</th>
                  <th className="px-3 py-2 text-right font-medium">2週</th>
                  <th className="px-3 py-2 text-right font-medium">4週未満</th>
                  <th className="px-3 py-2 text-right font-medium text-red-500">4週以上</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {FAIL_INVENTORY_HEATMAP.map((row) => {
                  const rowTotal = row.b24h + row.b48h + row.b1w + row.b2w + row.b4wUnder + row.b4wOver;
                  return (
                    <tr key={row.label} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{row.label}</td>
                      {[row.b24h, row.b48h, row.b1w, row.b2w, row.b4wUnder].map((v, i) => (
                        <td
                          key={i}
                          className={`px-3 py-2.5 text-right ${v === 0 ? "text-gray-300" : v >= 5 ? "font-semibold text-amber-600" : "text-gray-700"}`}
                        >
                          {v || "-"}
                        </td>
                      ))}
                      <td
                        className={`px-3 py-2.5 text-right ${row.b4wOver > 0 ? "font-bold text-red-600" : "text-gray-300"}`}
                      >
                        {row.b4wOver > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                            {row.b4wOver}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-50 text-xs text-gray-400">
            ※ 4週以上は長期滞留アラート対象（滅却/持ち戻り要検討）
          </div>
        </div>
      </div>

      {/* ── 審査区分内訳 + 原価速報 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 審査区分 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">審査区分内訳</h3>
          <div className="flex gap-4">
            {[
              { label: "区分1 (許可)", count: MOCK_KPI.kubun1, color: "bg-blue-500", pct: (MOCK_KPI.kubun1 / MOCK_KPI.permitted * 100).toFixed(1) },
              { label: "区分2 (書類)", count: MOCK_KPI.kubun2, color: "bg-amber-400", pct: (MOCK_KPI.kubun2 / MOCK_KPI.permitted * 100).toFixed(1) },
              { label: "区分3 (検査)", count: MOCK_KPI.kubun3, color: "bg-red-400",   pct: (MOCK_KPI.kubun3 / MOCK_KPI.permitted * 100).toFixed(1) },
            ].map((item) => (
              <div key={item.label} className="flex-1 text-center">
                <div className={`h-1.5 rounded-full ${item.color} mb-2`} style={{ width: `${item.pct}%`, minWidth: "8px" }} />
                <div className="text-2xl font-bold text-gray-900">{item.count.toLocaleString()}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                <div className="text-sm font-medium text-gray-600">{item.pct}%</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-500">
              <span>終了系（滅却/積戻し/撤回）</span>
              <span className="font-semibold text-gray-700">{MOCK_KPI.terminatedCount}件</span>
            </div>
          </div>
        </div>

        {/* 原価速報 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">原価速報（日次）</h3>
          <div className="space-y-3">
            {[
              { label: "通関士", count: MOCK_KPI.staffCustoms, unit: "名", unitCost: 38, total: MOCK_KPI.staffCustoms * 38 },
              { label: "加工担当", count: MOCK_KPI.staffProcessing, unit: "名", unitCost: 26, total: MOCK_KPI.staffProcessing * 26 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="text-xs text-gray-400">{item.count}{item.unit} × {item.unitCost}千円</span>
                </div>
                <span className="font-semibold text-gray-800">{item.total}千円</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-sm font-bold">
              <span className="text-gray-700">合計人件費速報</span>
              <span className="text-gray-900">{MOCK_KPI.personnelCostForecast}千円</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>許可1件単価（速報）</span>
              <span className={`font-semibold ${MOCK_KPI.unitCostPerPermit <= MOCK_KPI.unitCostTarget ? "text-green-600" : "text-amber-600"}`}>
                {MOCK_KPI.unitCostPerPermit}円
                <span className="text-xs font-normal text-gray-400 ml-1">
                  (目標 {MOCK_KPI.unitCostTarget}円)
                </span>
              </span>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400">
            ※ 速報値: マスター単価×実績人数。確定値は翌月10日以降。
          </div>
        </div>
      </div>
    </div>    </div>  );
}
