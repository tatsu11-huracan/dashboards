import KpiCard from "@/app/_components/KpiCard";

// ─── データ ───────────────────────────────────────────────────────
const BUSINESSES = [
  { name: "輸入通関", revenue: 12840, cost: 9210, profit: 3630, budget: 13000 },
  { name: "輸入保税", revenue:  8920, cost: 6130, profit: 2790, budget:  9000 },
  { name: "配送",     revenue: 15640, cost: 13180, profit: 2460, budget: 16000 },
  { name: "倉庫",     revenue:  4280, cost: 2960, profit: 1320, budget:  4500 },
];

const MOCK = {
  totalRevenue: 41680,
  totalCost:    31480,
  totalProfit:  10200,
  budgetAchievementRate: 98.2,
  unitPriceBudget: 1250,
  unitPriceActual: 1187,
  irregularCostRate: 4.2,
  forecastAccuracy:  83.1,
};

const MONTHLY_TREND = [
  { month: "1月", count: 28400 },
  { month: "2月", count: 25100 },
  { month: "3月", count: 32600 },
  { month: "4月", count: 29800 },
  { month: "5月", count: 31200 },
  { month: "6月", count: 18900 }, // 月中
];

const FORECAST_TABLE = [
  { client: "TikTok Shop", forecast: 18200, actual: 15640, gap: -13.9 },
  { client: "TEMU",        forecast: 12000, actual: 13480, gap: +12.3 },
  { client: "その他EC",    forecast:  8500, actual:  9120, gap:  +7.3 },
  { client: "既存輸入",    forecast:  4800, actual:  3440, gap: -28.3 },
];

// ─── ページ ───────────────────────────────────────────────────────
export default function SalesDashboardPage() {
  const maxCount = Math.max(...MONTHLY_TREND.map((m) => m.count));
  const totalBudget = BUSINESSES.reduce((s, b) => s + b.budget, 0);

  return (
    <div className="min-h-screen">
      {/* トップバー */}
      <div className="bg-gray-900 text-white px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="text-gray-400 hover:text-white text-xs flex items-center gap-1 transition-colors">
            ← 部門一覧
          </a>
          <span className="text-gray-600">|</span>
          <span className="text-sm font-semibold">営業・管理</span>
        </div>
        <span className="text-[10px] text-gray-500">ESP3.0 ダッシュボード</span>
      </div>

    <div className="p-6 space-y-5">
      {/* ヘッダー */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">営業・管理ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          集計日: 2026-06-16（月中速報）｜ 更新: 07:05 JST
        </p>
      </div>

      {/* 速報 KPI カード */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="総売上（月中速報）"
          value={(MOCK.totalRevenue / 1000).toFixed(1)}
          unit="百万円"
          status="normal"
        />
        <KpiCard
          label="総原価（速報）"
          value={(MOCK.totalCost / 1000).toFixed(1)}
          unit="百万円"
          status="normal"
        />
        <KpiCard
          label="粗利（速報）"
          value={(MOCK.totalProfit / 1000).toFixed(1)}
          unit="百万円"
          status="normal"
          highlight
        />
        <KpiCard
          label="予算達成率"
          value={MOCK.budgetAchievementRate}
          unit="%"
          target="100%"
          status={MOCK.budgetAchievementRate >= 90 ? "normal" : "warning"}
          highlight
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <KpiCard
          label="実績単価（速報）"
          value={MOCK.unitPriceActual}
          unit="円"
          sub={`目標 ${MOCK.unitPriceBudget}円`}
          status={
            MOCK.unitPriceActual >= MOCK.unitPriceBudget * 0.95 ? "normal" : "warning"
          }
        />
        <KpiCard
          label="イレギュラーコスト比率"
          value={MOCK.irregularCostRate}
          unit="%"
          target="5%以下"
          status={MOCK.irregularCostRate <= 5 ? "normal" : "warning"}
        />
        <KpiCard
          label="営業フォーキャスト精度"
          value={MOCK.forecastAccuracy}
          unit="%"
          target="80%以上"
          status={MOCK.forecastAccuracy >= 80 ? "normal" : "warning"}
        />
      </div>

      {/* 事業別損益 + 月次推移 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 事業別損益テーブル */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">事業別損益（月中速報）</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-100">
                <th className="text-left py-1.5 font-medium">事業</th>
                <th className="text-right py-1.5 font-medium">売上</th>
                <th className="text-right py-1.5 font-medium">原価</th>
                <th className="text-right py-1.5 font-medium">粗利</th>
                <th className="text-right py-1.5 font-medium">達成率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {BUSINESSES.map((b) => {
                const achievement = Math.round((b.revenue / b.budget) * 100);
                return (
                  <tr key={b.name}>
                    <td className="py-2 font-medium text-gray-700">{b.name}</td>
                    <td className="text-right">{b.revenue.toLocaleString()}</td>
                    <td className="text-right text-gray-500">{b.cost.toLocaleString()}</td>
                    <td
                      className={`text-right font-semibold ${
                        b.profit > 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {b.profit.toLocaleString()}
                    </td>
                    <td
                      className={`text-right font-semibold ${
                        achievement >= 95
                          ? "text-green-600"
                          : achievement >= 90
                          ? "text-amber-600"
                          : "text-red-600"
                      }`}
                    >
                      {achievement}%
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-800">
                <td className="py-2">合計</td>
                <td className="text-right">{MOCK.totalRevenue.toLocaleString()}</td>
                <td className="text-right text-gray-500">{MOCK.totalCost.toLocaleString()}</td>
                <td className="text-right text-green-600">{MOCK.totalProfit.toLocaleString()}</td>
                <td
                  className={`text-right ${
                    MOCK.budgetAchievementRate >= 95 ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {MOCK.budgetAchievementRate}%
                </td>
              </tr>
            </tbody>
          </table>
          <div className="flex justify-between mt-2 text-[10px] text-gray-400">
            <span>単位: 千円</span>
            <span>予算合計: {totalBudget.toLocaleString()}千円</span>
          </div>
        </div>

        {/* 月次件数推移 */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">月次取扱件数推移</h3>
          <div className="flex items-end gap-2 h-36 px-2">
            {MONTHLY_TREND.map((m) => {
              const barHeight = Math.round((m.count / maxCount) * 120);
              const isCurrent = m.month === "6月";
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[10px] text-gray-500">
                    {(m.count / 1000).toFixed(1)}k
                  </div>
                  <div
                    className={`w-full rounded-t ${
                      isCurrent ? "bg-blue-300" : "bg-blue-500"
                    }`}
                    style={{ height: `${barHeight}px` }}
                  />
                  <div
                    className={`text-[10px] ${
                      isCurrent ? "text-blue-600 font-semibold" : "text-gray-500"
                    }`}
                  >
                    {m.month}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-blue-500 mt-1">6月は月中（6/16時点）の速報値</p>
        </div>
      </div>

      {/* 営業フォーキャスト精度テーブル */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          営業フォーキャスト精度（顧客別）
        </h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-100">
              <th className="text-left py-1.5 font-medium">顧客</th>
              <th className="text-right py-1.5 font-medium">予測件数</th>
              <th className="text-right py-1.5 font-medium">実績件数</th>
              <th className="text-right py-1.5 font-medium">乖離率</th>
              <th className="py-1.5 pl-3 font-medium">ステータス</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {FORECAST_TABLE.map((f) => {
              const isWarning = Math.abs(f.gap) > 20;
              return (
                <tr key={f.client} className={isWarning ? "bg-red-50" : ""}>
                  <td className="py-1.5 font-medium text-gray-700">{f.client}</td>
                  <td className="text-right">{f.forecast.toLocaleString()}</td>
                  <td className="text-right">{f.actual.toLocaleString()}</td>
                  <td
                    className={`text-right font-semibold ${
                      f.gap > 0 ? "text-green-600" : isWarning ? "text-red-600" : "text-amber-600"
                    }`}
                  >
                    {f.gap > 0 ? "+" : ""}
                    {f.gap.toFixed(1)}%
                  </td>
                  <td className="pl-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isWarning
                          ? "bg-red-100 text-red-700"
                          : Math.abs(f.gap) > 10
                          ? "bg-amber-100 text-amber-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isWarning ? "要確認" : Math.abs(f.gap) > 10 ? "注意" : "正常"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-400 mt-2">±20%超で警告。フォーキャスト入力元・責任部署は確認待ち。</p>
      </div>

      {/* 速報値注記バナー */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-amber-500 mt-0.5">⚠</span>
          <div className="text-xs text-amber-800 space-y-0.5">
            <div className="font-semibold">速報値について</div>
            <div>
              月中は標準単価（マスター単価）×件数で計算。確定値はマネーフォワード連携後、翌月10日以降に反映されます。
            </div>
            <div className="text-amber-600 mt-1">
              確認待ち: 母数日付基準（依頼日/搬出日/引渡し日）の確定 ／ 業者コード・科目コード統一 ／ 営業フォーキャスト入力元と責任部署
            </div>
          </div>
        </div>
      </div>
    </div>    </div>  );
}
