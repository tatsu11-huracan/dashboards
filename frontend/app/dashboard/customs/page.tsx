import Link from "next/link";
import { pool } from "@/lib/db";
import KpiCard from "@/app/_components/KpiCard";

type CustomsSiteKey = "kix" | "nrt";

const CUSTOMS_SITES: Record<CustomsSiteKey, { label: string; locationCode: string; routeLabel: string; rule: string }> = {
  kix: {
    label: "関西/関空", locationCode: "KIX", routeLabel: "KIX",
    rule: "15時までに突合→当日処理（15時以降の追加は翌日）　／　キャセイ・ANAは搬出予約必須　／　24hフリータイム超過でターミナルコスト　／　E-Naccs表記統一・区分2/3警告閾値は確認待ち"
  },
  nrt: {
    label: "関東/成田", locationCode: "NRT", routeLabel: "NRT",
    rule: "前日到着分の翌日処理が中心　／　17:30以降のOUTなし　／　許可済み未搬出は48h超で警告　／　区分2/3が15%超で警告"
  },
};

function normalizeSite(site: string | string[] | undefined): CustomsSiteKey {
  const v = Array.isArray(site) ? site[0] : site;
  return v === "nrt" ? "nrt" : "kix";
}

async function getLocationRules(locationCode: string) {
  try {
    const result = await pool.query(
      `SELECT rule_key, rule_value, rule_description FROM business_location_rule
       WHERE tenant_id='ESP3' AND business_location_code=$1
         AND is_displayed_on_dashboard=1
         AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY display_order`,
      [locationCode]
    );
    return result.rows as { rule_key: string; rule_value: string; rule_description: string }[];
  } catch { return []; }
}

// KPIモック（拠点別）
const KPI_DATA: Record<CustomsSiteKey, {
  received: number; merged: number; undeclared: number; unpermitted: number;
  permitted: number; released: number;
  kubun1: number; kubun2: number; kubun3: number;
  permitRate: number; naccsRate: number; hpkHitRate: number;
  ltHours: number; permitPendingShipout: number;
  staffCustoms: number; staffProcessing: number; personnelCostK: number;
}> = {
  kix: {
    received: 9000, merged: 8200, undeclared: 322, unpermitted: 285,
    permitted: 7890, released: 7750,
    kubun1: 7450, kubun2: 320, kubun3: 120,
    permitRate: 96.5, naccsRate: 91.2, hpkHitRate: 88.7,
    ltHours: 5.2, permitPendingShipout: 140,
    staffCustoms: 7, staffProcessing: 10, personnelCostK: 718,
  },
  nrt: {
    received: 7000, merged: 6400, undeclared: 215, unpermitted: 198,
    permitted: 6020, released: 5840,
    kubun1: 5680, kubun2: 240, kubun3: 100,
    permitRate: 95.8, naccsRate: 89.4, hpkHitRate: 86.1,
    ltHours: 22.1, permitPendingShipout: 198,
    staffCustoms: 5, staffProcessing: 8, personnelCostK: 554,
  },
};

// 滞留チップ
const DWELL_DATA: Record<CustomsSiteKey, Array<{ stage: string; label: string; count: number; overCount?: number; level: "normal" | "warn" | "danger" | "tmr"; recovery?: string }>> = {
  kix: [
    { stage: "データ受領→HS確認", label: "HS確認待ち", count: 120, level: "warn", recovery: "HS確認後にクレンジングへ進行" },
    { stage: "クレンジング中", label: "クレンジング滞留", count: 38, level: "normal", recovery: "現物確認後に解消" },
    { stage: "通関士チェック", label: "未申告在庫", count: 322, level: "danger", overCount: 0, recovery: "書類整備後に申告へ" },
    { stage: "申告→区分判定", label: "区分2/3（追加審査中）", count: 285, overCount: 70, level: "danger", recovery: "税関回答後に許可or再申告" },
    { stage: "HPK待ち", label: "HPKエラー", count: 25, level: "warn", recovery: "要因解消→再実行" },
    { stage: "搬出待ち", label: "⏰ 翌日繰越", count: 140, level: "tmr", recovery: "翌日便カットライン管理" },
  ],
  nrt: [
    { stage: "データ受領→HS確認", label: "HS確認待ち", count: 95, level: "warn" },
    { stage: "クレンジング中", label: "クレンジング滞留", count: 28, level: "normal" },
    { stage: "通関士チェック", label: "未申告在庫", count: 215, level: "danger", overCount: 0 },
    { stage: "申告→区分判定", label: "区分2/3（追加審査中）", count: 198, overCount: 55, level: "danger" },
    { stage: "HPK待ち", label: "HPKエラー", count: 18, level: "warn" },
    { stage: "搬出待ち", label: "⏰ 翌日繰越", count: 198, level: "tmr" },
  ],
};

// パイプラインステージ
const PIPELINE_STAGES = [
  { code: "受領", label: "データ受領\n（API/メール）" },
  { code: "HS確認", label: "HS/アイテムコード\n確認" },
  { code: "クレンジング", label: "データ加工\nクレンジング" },
  { code: "申告準備", label: "通関士チェック\nNACCS準備" },
  { code: "HPK", label: "申告・HPK\n（保税側）" },
  { code: "区分判定", label: "区分1/2/3\n区分判定" },
  { code: "許可", label: "許可\n（搬出可）" },
];

const COUNTS: Record<CustomsSiteKey, number[]> = {
  kix: [9000, 8760, 8522, 8200, 8200, 7890, 7750],
  nrt: [7000, 6820, 6640, 6400, 6400, 6020, 5840],
};

const CHIP_COLOR = {
  normal: "bg-yellow-50 border-yellow-400 text-yellow-800",
  warn: "bg-orange-50 border-orange-400 text-orange-800",
  danger: "bg-red-50 border-red-500 text-red-800",
  tmr: "bg-violet-50 border-violet-400 text-violet-800",
};

export default async function CustomsDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ site?: string | string[] }>;
}) {
  const sp = await searchParams;
  const siteKey = normalizeSite(sp?.site);
  const site = CUSTOMS_SITES[siteKey];
  const kpi = KPI_DATA[siteKey];
  const dwells = DWELL_DATA[siteKey];
  const counts = COUNTS[siteKey];
  const locationRules = await getLocationRules(site.locationCode);

  return (
    <div className="min-h-screen bg-[#f4f7fb]">
      {/* トップバー */}
      <div className="bg-[#111827] text-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs transition-colors">← 全体</Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-bold">通関部ダッシュボード</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-500 mr-1">拠点</span>
          {Object.entries(CUSTOMS_SITES).map(([key, item]) => (
            <Link key={key} href={`/dashboard/customs?site=${key}`}
              className={`px-3 py-1 rounded-full border transition-colors ${siteKey === key ? "bg-white text-gray-900 border-white font-semibold" : "text-gray-300 border-gray-700 hover:border-gray-400 hover:text-white"}`}>
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4 max-w-[1440px] mx-auto">

        {/* ヘッダー */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#172033] tracking-tight">通関ダッシュボード｜予備審査 × 貨物ルート</h1>
            <p className="text-sm text-gray-500 mt-1">拠点: {site.label} ({site.routeLabel})　集計日: 2026-06-16　更新: 08:05 JST</p>
          </div>
          <div className="flex gap-2 text-sm flex-wrap">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-gray-400">通関士</div>
              <div className="text-xl font-black text-blue-600">{kpi.staffCustoms}名</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-gray-400">加工</div>
              <div className="text-xl font-black text-blue-600">{kpi.staffProcessing}名</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 text-center">
              <div className="text-xs text-gray-400">人件費速報</div>
              <div className="text-xl font-black text-gray-800">{kpi.personnelCostK}千円</div>
            </div>
          </div>
        </div>

        {/* ルールバー */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-900 font-medium">
          {locationRules.length > 0
            ? locationRules.map(r => `${r.rule_value}${r.rule_description ? ` — ${r.rule_description}` : ""}`).join("　／　")
            : site.rule}
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="本日対象件数" value={kpi.received.toLocaleString()} unit="件" status="normal" />
          <KpiCard label="3条件合流済み" value={kpi.merged.toLocaleString()} unit="件" sub={`合流率 ${((kpi.merged/kpi.received)*100).toFixed(1)}%`} status="normal" />
          <KpiCard label="未申告在庫" value={kpi.undeclared.toLocaleString()} unit="件" status={kpi.undeclared > 300 ? "warning" : "normal"} highlight />
          <KpiCard label="未許可在庫" value={kpi.unpermitted.toLocaleString()} unit="件" status={kpi.unpermitted > 200 ? "warning" : "normal"} highlight />
          <KpiCard label="許可済み" value={kpi.permitted.toLocaleString()} unit="件" status="normal" />
          <KpiCard label="搬出済み" value={kpi.released.toLocaleString()} unit="件" status="normal" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="許可率" value={kpi.permitRate} unit="%" target="97%" status={kpi.permitRate >= 97 ? "normal" : "warning"} />
          <KpiCard label="E-Naccs投入済率" value={kpi.naccsRate} unit="%" target="90%" status={kpi.naccsRate >= 90 ? "normal" : "warning"} />
          <KpiCard label="HPKに間に合った率" value={kpi.hpkHitRate} unit="%" target="90%" status={kpi.hpkHitRate >= 90 ? "normal" : "warning"} />
          <KpiCard label="到着→許可リードタイム" value={kpi.ltHours} unit="h" target={siteKey==="kix"?"6h":"24h"} status={kpi.ltHours <= (siteKey==="kix"?6:24) ? "normal" : "warning"} />
          <KpiCard label="許可済み未搬出" value={kpi.permitPendingShipout} unit="件" status={kpi.permitPendingShipout > 100 ? "warning" : "normal"} />
          <KpiCard label="区分2/3比率" value={`${(((kpi.kubun2+kpi.kubun3)/kpi.permitted)*100).toFixed(1)}`} unit="%" target="15%以下" status={(kpi.kubun2+kpi.kubun3)/kpi.permitted > 0.15 ? "warning" : "normal"} />
        </div>

        {/* 保税上段レーン */}
        <div className="border-2 border-dashed border-gray-400 rounded-xl bg-gray-100 px-5 py-3 flex flex-wrap items-center gap-3 text-gray-600 text-sm">
          <span className="bg-gray-500 text-white text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap">保税側（参考・点線）</span>
          {["APK/PKG", "OUT・横持ち", "BIN登録", "突合（申告/マニ/IDA）"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2 font-semibold text-xs">
              {s}{i < arr.length - 1 && <span className="text-gray-400">─▶</span>}
            </span>
          ))}
          <span className="text-blue-700 font-bold text-xs">─▶ HPK実行 ※保税の仕事</span>
        </div>
        <div className="flex justify-center">
          <div className="relative h-6 w-px border-l-2 border-dashed border-gray-400">
            <span className="absolute left-2 top-1 text-[11px] text-gray-500 whitespace-nowrap font-bold">▼ HPKステータス連携（17時時点で判定）</span>
          </div>
        </div>

        {/* 横型パイプライン */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 overflow-x-auto">
          <div className="flex items-start gap-0" style={{minWidth: "1100px"}}>
            {PIPELINE_STAGES.map((stage, idx) => (
              <div key={stage.code} className="flex items-start">
                {/* ステージカード */}
                <div className="flex flex-col items-center" style={{width: "140px"}}>
                  <div className="w-full bg-[#dbe9f9] border-2 border-[#1f4e79] rounded-xl p-2 text-center min-h-[86px]">
                    <div className="text-[11px] font-black text-[#1f4e79] leading-tight whitespace-pre-line">{stage.label}</div>
                    <div className="text-2xl font-black tabular-nums mt-1">{counts[idx].toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">件</div>
                  </div>
                  {/* 滞留チップ */}
                  {dwells.filter(d => d.stage.includes(stage.code.replace("確認","").replace("クレンジング","クレンジング").replace("申告","申告"))).length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 w-full">
                      <div className="self-center border-l-2 border-dotted border-amber-500 h-2.5" />
                      {dwells.filter(d => d.stage.includes(stage.code.replace("確認","").slice(0,4))).map(d => (
                        <div key={d.label} className={`text-[10px] font-bold rounded-lg px-2 py-1 border text-center ${CHIP_COLOR[d.level]}`}>
                          <div className="text-base font-black tabular-nums leading-none">{d.count}<span className="text-[10px]">件</span></div>
                          <div>{d.label}</div>
                          {d.overCount !== undefined && d.overCount > 0 && <div className="text-red-600">超過{d.overCount}</div>}
                          {d.recovery && <div className="text-green-700 mt-0.5">{d.recovery}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* コネクタ（最後以外） */}
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="flex flex-col items-center pt-7 flex-shrink-0" style={{width: "72px"}}>
                    <div className="text-[11px] font-bold text-blue-600 mb-1 whitespace-nowrap">
                      {(counts[idx] - counts[idx+1]).toLocaleString()}
                    </div>
                    <div className="w-full h-2.5 rounded"
                      style={{background: "repeating-linear-gradient(90deg, #2563eb 0 8px, #bfdbfe 8px 16px)", backgroundSize: "16px 100%"}} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 凡例 */}
          <div className="flex flex-wrap gap-3 mt-4 text-[11px] text-gray-500">
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-3 rounded bg-[#dbe9f9] border-2 border-[#1f4e79]" />通常工程（通過件数）</span>
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-3 rounded bg-yellow-50 border border-yellow-400" />滞留（KPI内）</span>
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-3 rounded bg-red-50 border border-red-500" />滞留大 / <span className="text-red-600 font-bold">超過n</span>=KPIオーバー</span>
            <span className="flex items-center gap-1"><span className="inline-block w-5 h-3 rounded bg-violet-50 border border-violet-400" />⏰ 翌日へ繰越</span>
          </div>
        </div>

        {/* 区分別 + 不備在庫 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 区分別 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-black text-gray-800 mb-3">申告区分別件数</h3>
            {[
              { label: "区分1（即許可）", count: kpi.kubun1, pct: ((kpi.kubun1/kpi.permitted)*100).toFixed(1), color: "bg-green-500" },
              { label: "区分2（審査）", count: kpi.kubun2, pct: ((kpi.kubun2/kpi.permitted)*100).toFixed(1), color: "bg-amber-500" },
              { label: "区分3（検査）", count: kpi.kubun3, pct: ((kpi.kubun3/kpi.permitted)*100).toFixed(1), color: "bg-red-500" },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 mb-3">
                <div className="w-28 text-xs text-gray-700 font-medium shrink-0">{item.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{width: `${item.pct}%`}} />
                </div>
                <div className="w-14 text-right text-sm font-bold text-gray-800">{item.count.toLocaleString()}</div>
                <div className="w-10 text-right text-xs text-gray-500">{item.pct}%</div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 mt-2">区分2/3合計が15%超で警告対象</p>
          </div>

          {/* 速報原価 */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-black text-gray-800 mb-3">速報原価</h3>
            <div className="space-y-2">
              {[
                { label: "人件費（速報）", value: `${kpi.personnelCostK}千円` },
                { label: "許可1件単価", value: `${Math.round(kpi.personnelCostK*1000/kpi.permitted)}円`, note: "目標 280円" },
                { label: "処理能力（件/人時）", value: `${Math.round(kpi.permitted/(kpi.staffCustoms+kpi.staffProcessing))}件` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="font-bold text-gray-900">{item.value}{item.note && <span className="text-xs text-gray-400 ml-2">({item.note})</span>}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">速報値: マスター単価×実績人数。確定値は翌月10日以降。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
