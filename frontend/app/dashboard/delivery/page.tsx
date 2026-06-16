"use client";

import { useState } from "react";
import Link from "next/link";
import KpiCard from "@/app/_components/KpiCard";
import FlowDiagram, { FlowStep } from "@/app/_components/FlowDiagram";

// ─── 輸入貨物配送 データ ──────────────────────────────────────────
const DELIVERY_KPI = {
  handoverCount: 1876,
  sortingInProgress: 187,
  chuteNoDataRate: 2.3,
  loadedRate: 96.4,
  deliveryCompleteRate: 95.8,
  complete24hRate: 91.2,
  returnRate: 5.8,
  misdeliveryCount: 3,
  driverProductivityAvg: 112,
  vendorIssueCount: 7,
  deliveryCostK: 892,
};

const RETURN_REASONS = [
  { reason: "不在",       count: 89, pct: 45.6 },
  { reason: "住所不備",   count: 23, pct: 11.8 },
  { reason: "顧客都合",   count: 38, pct: 19.5 },
  { reason: "破損・汚損", count:  4, pct:  2.1 },
  { reason: "ラベル破損", count: 11, pct:  5.6 },
  { reason: "その他",     count: 30, pct: 15.4 },
];

const VENDOR_QUALITY = [
  { vendor: "A社", out: 820, rate: 96.2, mis: 1 },
  { vendor: "B社", out: 634, rate: 94.8, mis: 2 },
  { vendor: "C社", out: 312, rate: 91.3, mis: 0 },
  { vendor: "D社", out: 110, rate: 88.2, mis: 0 },
];

const DELIVERY_FLOW: FlowStep[] = [
  { code: "D-01", name: "引渡し受領", dwellCount: 42 },
  { code: "D-03", name: "仕分け",     dwellCount: 187 },
  { code: "D-04", name: "Chute",      dwellCount: 8 },
  { code: "D-06", name: "積込み",     dwellCount: 0 },
  { code: "D-07", name: "配達中",     dwellCount: 0 },
  { code: "D-08", name: "完了",       isTerminal: true },
];

// ─── 国内集荷 データ ─────────────────────────────────────────────
const PICKUP_KPI = {
  requestCount: 348,
  todayCutRatio: 71.3,
  contactPendingCount: 28,
  driverAssignedRate: 88.5,
  successRate: 82.4,
  rescheduleRate: 12.1,
  failCount: 61,
  toSortingLeadTime: 3.2,
  todayPredictedCount: 412,
};

const FAIL_REASONS = [
  { reason: "荷物未準備",  count: 18, pct: 29.5 },
  { reason: "不在",         count: 14, pct: 22.9 },
  { reason: "ラベル未貼付", count: 12, pct: 19.7 },
  { reason: "閉店/営業外", count:  9, pct: 14.8 },
  { reason: "連絡不能",     count:  5, pct:  8.2 },
  { reason: "住所不明",     count:  3, pct:  4.9 },
];

const DRIVER_STATUS = [
  { name: "田中 D", assigned: 24, completed: 19, status: "配達中" },
  { name: "佐藤 D", assigned: 31, completed: 28, status: "帰庫" },
  { name: "鈴木 D", assigned: 18, completed: 12, status: "配達中" },
  { name: "高橋 D", assigned: 27, completed: 27, status: "完了" },
  { name: "渡辺 D", assigned: 22, completed: 16, status: "配達中" },
];

const PICKUP_FLOW: FlowStep[] = [
  { code: "P-01", name: "集荷依頼受付",   dwellCount: PICKUP_KPI.requestCount },
  { code: "P-03", name: "ドライバー配信", dwellCount: PICKUP_KPI.contactPendingCount },
  { code: "P-05", name: "集荷実施",       dwellCount: 0 },
  { code: "P-07", name: "配送投入",       dwellCount: 0 },
  { code: "P-08", name: "仕分け接続",     isTerminal: true },
];

// ─── 輸入貨物配送 コンテンツ ──────────────────────────────────────
function DeliveryContent() {
  const totalReturn = RETURN_REASONS.reduce((s, r) => s + r.count, 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard label="引渡し件数" value={DELIVERY_KPI.handoverCount} unit="件" status="normal" />
        <KpiCard label="仕分け中" value={DELIVERY_KPI.sortingInProgress} unit="件" status={DELIVERY_KPI.sortingInProgress > 200 ? "warning" : "normal"} />
        <KpiCard label="Chute NO_DATA率" value={DELIVERY_KPI.chuteNoDataRate} unit="%" target="1%以下" status={DELIVERY_KPI.chuteNoDataRate > 1 ? "warning" : "normal"} />
        <KpiCard label="積込率" value={DELIVERY_KPI.loadedRate} unit="%" target="100%" status={DELIVERY_KPI.loadedRate < 95 ? "warning" : "normal"} />
        <KpiCard label="配達完了率" value={DELIVERY_KPI.deliveryCompleteRate} unit="%" target="95%" status={DELIVERY_KPI.deliveryCompleteRate >= 95 ? "normal" : "warning"} highlight />
        <KpiCard label="24h達成率" value={DELIVERY_KPI.complete24hRate} unit="%" target="90%" status={DELIVERY_KPI.complete24hRate >= 90 ? "normal" : "warning"} highlight />
      </div>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-5">
        <KpiCard label="持ち戻り率" value={DELIVERY_KPI.returnRate} unit="%" target="5%以下" status={DELIVERY_KPI.returnRate <= 5 ? "normal" : "warning"} />
        <KpiCard label="誤配件数（月次）" value={DELIVERY_KPI.misdeliveryCount} unit="件" target="10件以下" status={DELIVERY_KPI.misdeliveryCount <= 10 ? "normal" : "critical"} />
        <KpiCard label="ドライバー生産性" value={DELIVERY_KPI.driverProductivityAvg} unit="件/日" target="100件" status={DELIVERY_KPI.driverProductivityAvg >= 100 ? "normal" : "warning"} />
        <KpiCard label="業者品質問題件数" value={DELIVERY_KPI.vendorIssueCount} unit="件" status={DELIVERY_KPI.vendorIssueCount > 10 ? "warning" : "normal"} />
        <KpiCard label="配送原価（速報）" value={DELIVERY_KPI.deliveryCostK} unit="千円" status="normal" />
      </div>

      <FlowDiagram steps={DELIVERY_FLOW} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">持ち戻り理由別</h3>
            <span className="text-xs text-gray-400">合計 {totalReturn}件</span>
          </div>
          <div className="space-y-2.5">
            {RETURN_REASONS.map((item) => (
              <div key={item.reason} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600 shrink-0">{item.reason}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
                <div className="w-8 text-right text-xs font-semibold text-gray-700">{item.count}</div>
                <div className="w-10 text-right text-xs text-gray-400">{item.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">業者別品質</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">業者</th>
                <th className="text-right py-1.5 font-medium">持ち出し</th>
                <th className="text-right py-1.5 font-medium">完了率</th>
                <th className="text-right py-1.5 font-medium">誤配</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {VENDOR_QUALITY.map((v) => (
                <tr key={v.vendor} className={v.rate < 90 ? "bg-red-50" : ""}>
                  <td className="py-1.5 font-medium">{v.vendor}</td>
                  <td className="text-right">{v.out.toLocaleString()}</td>
                  <td className={`text-right font-semibold ${v.rate < 90 ? "text-red-600" : v.rate < 95 ? "text-amber-600" : "text-green-600"}`}>{v.rate}%</td>
                  <td className="text-right">{v.mis}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-3">専属判定: 100件/日以上 ｜ 18:30カットオフ・20時積込完了基準</p>
        </div>
      </div>
    </div>
  );
}

// ─── 国内集荷 コンテンツ ──────────────────────────────────────────
function PickupContent() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard label="集荷依頼件数" value={PICKUP_KPI.requestCount} unit="件" sub={`予定 ${PICKUP_KPI.todayPredictedCount}件`} status="normal" />
        <KpiCard label="12時カット当日比率" value={PICKUP_KPI.todayCutRatio} unit="%" target="70%" status={PICKUP_KPI.todayCutRatio >= 70 ? "normal" : "warning"} />
        <KpiCard label="連絡未了件数" value={PICKUP_KPI.contactPendingCount} unit="件" status={PICKUP_KPI.contactPendingCount > 30 ? "warning" : "normal"} />
        <KpiCard label="アプリ配信済率" value={PICKUP_KPI.driverAssignedRate} unit="%" target="90%" status={PICKUP_KPI.driverAssignedRate >= 90 ? "normal" : "warning"} />
        <KpiCard label="集荷成功率" value={PICKUP_KPI.successRate} unit="%" target="95%" status={PICKUP_KPI.successRate >= 95 ? "normal" : "warning"} highlight />
        <KpiCard label="再集荷率" value={PICKUP_KPI.rescheduleRate} unit="%" target="10%以下" status={PICKUP_KPI.rescheduleRate <= 10 ? "normal" : "warning"} />
      </div>
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-3">
        <KpiCard label="集荷失敗件数" value={PICKUP_KPI.failCount} unit="件" status={PICKUP_KPI.failCount > 60 ? "warning" : "normal"} />
        <KpiCard label="集荷→配送投入LT" value={PICKUP_KPI.toSortingLeadTime} unit="h" target="4h以内" status={PICKUP_KPI.toSortingLeadTime <= 4 ? "normal" : "warning"} />
        <KpiCard label="本日集荷予定数" value={PICKUP_KPI.todayPredictedCount} unit="件" status="normal" />
      </div>

      <FlowDiagram steps={PICKUP_FLOW} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">集荷失敗理由別件数</h3>
            <span className="text-xs text-gray-400">合計 {PICKUP_KPI.failCount}件</span>
          </div>
          <div className="space-y-2.5">
            {FAIL_REASONS.map((item) => (
              <div key={item.reason} className="flex items-center gap-3">
                <div className="w-24 text-xs text-gray-600 shrink-0">{item.reason}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${item.pct}%` }} />
                </div>
                <div className="w-8 text-right text-xs font-semibold text-gray-700">{item.count}</div>
                <div className="w-10 text-right text-xs text-gray-400">{item.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ドライバー状況</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">ドライバー</th>
                <th className="text-right py-1.5 font-medium">担当</th>
                <th className="text-right py-1.5 font-medium">完了</th>
                <th className="text-right py-1.5 font-medium">達成率</th>
                <th className="py-1.5 pl-2 font-medium">状況</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {DRIVER_STATUS.map((d) => {
                const rate = Math.round((d.completed / d.assigned) * 100);
                return (
                  <tr key={d.name}>
                    <td className="py-1.5">{d.name}</td>
                    <td className="text-right">{d.assigned}</td>
                    <td className="text-right">{d.completed}</td>
                    <td className={`text-right font-semibold ${rate >= 90 ? "text-green-600" : "text-amber-600"}`}>{rate}%</td>
                    <td className="pl-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        d.status === "完了" ? "bg-green-100 text-green-700" :
                        d.status === "帰庫" ? "bg-gray-100 text-gray-600" :
                        "bg-blue-100 text-blue-700"
                      }`}>{d.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs font-medium text-gray-600 mb-2">12時カット区分</div>
            <div className="flex gap-2 text-xs">
              <div className="flex-1 bg-green-50 rounded p-2 text-center">
                <div className="text-green-700 font-bold text-lg">{PICKUP_KPI.requestCount}</div>
                <div className="text-green-600 text-[10px]">当日確定</div>
              </div>
              <div className="flex-1 bg-amber-50 rounded p-2 text-center">
                <div className="text-amber-700 font-bold text-lg">{PICKUP_KPI.contactPendingCount}</div>
                <div className="text-amber-600 text-[10px]">連絡中</div>
              </div>
              <div className="flex-1 bg-red-50 rounded p-2 text-center">
                <div className="text-red-700 font-bold text-lg">{PICKUP_KPI.failCount}</div>
                <div className="text-red-600 text-[10px]">失敗</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ページ本体 ───────────────────────────────────────────────────
type Tab = "delivery" | "pickup";
const TABS: { key: Tab; label: string }[] = [
  { key: "delivery", label: "輸入貨物配送（新木場）" },
  { key: "pickup",   label: "国内集荷（TikTok / TEMU）" },
];

export default function DeliveryDashboardPage() {
  const [tab, setTab] = useState<Tab>("delivery");

  return (
    <div className="min-h-screen">
      {/* トップバー */}
      <div className="bg-gray-900 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← 部門一覧
          </Link>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-semibold">配送部</span>
        </div>
        <span className="text-[10px] text-gray-500">ESP3.0 ダッシュボード</span>
      </div>

    <div className="p-6 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">配送部ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">集計日: 2026-06-16 ｜ 更新: 07:05 JST</p>
      </div>

      {/* タブ */}
      <div className="border-b border-gray-200">
        <div className="flex">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "delivery" ? <DeliveryContent /> : <PickupContent />}
    </div>
    </div>
  );
}
