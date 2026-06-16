import KpiCard from "@/app/_components/KpiCard";

const MOCK_KPI = {
  requestCount: 348,
  todayCutRatio: 71.3,
  contactPendingCount: 28,
  driverAssignedRate: 88.5,
  successRate: 82.4,
  rescheduleRate: 12.1,
  failCount: 61,
  toSortingLeadTime: 3.2,
  apiReturnFailureRate: 0.8,
  todayPredictedCount: 412,
};

const FAIL_REASONS = [
  { reason: "荷物未準備",    count: 18, pct: 29.5 },
  { reason: "不在",           count: 14, pct: 22.9 },
  { reason: "ラベル未貼付",  count: 12, pct: 19.7 },
  { reason: "閉店/営業外",   count: 9,  pct: 14.8 },
  { reason: "連絡不能",       count: 5,  pct: 8.2  },
  { reason: "住所不明",       count: 3,  pct: 4.9  },
];

const DRIVER_STATUS = [
  { name: "田中 D",   assigned: 24, completed: 19, status: "配達中" },
  { name: "佐藤 D",   assigned: 31, completed: 28, status: "帰庫" },
  { name: "鈴木 D",   assigned: 18, completed: 12, status: "配達中" },
  { name: "高橋 D",   assigned: 27, completed: 27, status: "完了" },
  { name: "渡辺 D",   assigned: 22, completed: 16, status: "配達中" },
];

export default function PickupDashboardPage() {
  return (
    <div className="p-6 space-y-5">
      {/* ヘッダー */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">国内集荷ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          TikTok / TEMU 等 ｜ 集計日: 2026-06-16 ｜ 更新: 07:05 JST
        </p>
      </div>

      {/* KPI カード */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-6">
        <KpiCard label="集荷依頼件数"      value={MOCK_KPI.requestCount}       unit="件" sub={`予定 ${MOCK_KPI.todayPredictedCount}件`} status="normal" />
        <KpiCard label="12時カット当日比率" value={MOCK_KPI.todayCutRatio}      unit="%" target="70.0%" status={MOCK_KPI.todayCutRatio >= 70 ? "normal" : "warning"} />
        <KpiCard label="連絡未了件数"       value={MOCK_KPI.contactPendingCount} unit="件" status={MOCK_KPI.contactPendingCount > 30 ? "warning" : "normal"} />
        <KpiCard label="アプリ配信済率"     value={MOCK_KPI.driverAssignedRate} unit="%" target="90.0%" status={MOCK_KPI.driverAssignedRate >= 90 ? "normal" : "warning"} />
        <KpiCard label="集荷成功率"         value={MOCK_KPI.successRate}        unit="%" target="85.0%" status={MOCK_KPI.successRate >= 85 ? "normal" : "warning"} highlight />
        <KpiCard label="再集荷率"           value={MOCK_KPI.rescheduleRate}     unit="%" target="10.0%" status={MOCK_KPI.rescheduleRate <= 10 ? "normal" : "warning"} />
      </div>

      <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
        <KpiCard label="集荷失敗件数"              value={MOCK_KPI.failCount}               unit="件" status={MOCK_KPI.failCount > 60 ? "warning" : "normal"} />
        <KpiCard label="集荷→配送投入LT"           value={MOCK_KPI.toSortingLeadTime}        unit="h" target="4h" status="normal" />
        <KpiCard label="PF API返送失敗率"          value={MOCK_KPI.apiReturnFailureRate}     unit="%" target="1.0%" status="normal" />
        <KpiCard label="本日集荷予定数"             value={MOCK_KPI.todayPredictedCount}     unit="件" status="normal" />
      </div>

      {/* 失敗理由別 + ドライバー状況 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 失敗理由別 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">集荷失敗理由別件数</h3>
            <span className="text-xs text-gray-400">合計 {MOCK_KPI.failCount}件</span>
          </div>
          <div className="space-y-2.5">
            {FAIL_REASONS.map((item) => (
              <div key={item.reason} className="flex items-center gap-3">
                <div className="w-24 text-xs text-gray-600 shrink-0">{item.reason}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="w-8 text-right text-xs font-semibold text-gray-700">{item.count}</div>
                <div className="w-10 text-right text-xs text-gray-400">{item.pct}%</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-400">
            ※ 失敗理由はプラットフォーム (TikTok/TEMU) へ API 返送。
          </div>
        </div>

        {/* ドライバー配信状況 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">ドライバー集荷状況</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">担当</th>
                  <th className="px-3 py-2 text-right font-medium">割当</th>
                  <th className="px-3 py-2 text-right font-medium">完了</th>
                  <th className="px-3 py-2 text-right font-medium">完了率</th>
                  <th className="px-3 py-2 text-center font-medium">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {DRIVER_STATUS.map((d) => {
                  const pct = Math.round((d.completed / d.assigned) * 100);
                  return (
                    <tr key={d.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-800 font-medium">{d.name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{d.assigned}</td>
                      <td className="px-3 py-2.5 text-right text-gray-700">{d.completed}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`font-semibold ${pct >= 90 ? "text-green-600" : pct >= 70 ? "text-amber-500" : "text-red-500"}`}>
                          {pct}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                            d.status === "完了"
                              ? "bg-green-100 text-green-700"
                              : d.status === "帰庫"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 12時カット状況 */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          12時カット — 当日/翌日区分
        </h3>
        <div className="flex gap-6">
          {[
            { label: "当日集荷対象",  count: Math.round(MOCK_KPI.requestCount * (MOCK_KPI.todayCutRatio / 100)), color: "bg-blue-500", badge: "当日" },
            { label: "翌日集荷対象",  count: Math.round(MOCK_KPI.requestCount * (1 - MOCK_KPI.todayCutRatio / 100)), color: "bg-gray-400", badge: "翌日" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-4">
              <span className={`inline-block text-xs px-2 py-0.5 rounded font-bold text-white ${item.color}`}>
                {item.badge}
              </span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{item.count}件</div>
                <div className="text-xs text-gray-500">{item.label}</div>
              </div>
            </div>
          ))}
          <div className="ml-4 border-l border-gray-200 pl-6 flex items-center gap-2">
            <span className="text-xs text-gray-500">連絡未了</span>
            <span className="text-2xl font-bold text-amber-500">{MOCK_KPI.contactPendingCount}件</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-400">
          ※ 12時カット基準: 12:00 JST 以前受付 → 当日対象、以降 → 翌日対象
        </div>
      </div>
    </div>
  );
}
