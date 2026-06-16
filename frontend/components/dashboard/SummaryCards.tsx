import type { SummaryMetrics } from "@/lib/mockData";

type Props = {
  metrics: SummaryMetrics;
};

const cardStyle = "bg-white border border-gray-200 rounded-lg p-4";

export default function SummaryCards({ metrics }: Props) {
  const cards = [
    { label: "当日処理対象件数", value: `${metrics.todayTarget.toLocaleString()} 件`, tone: "text-gray-900" },
    { label: "未申告件数", value: `${metrics.undeclared.toLocaleString()} 件`, tone: "text-red-700" },
    { label: "BIN済み未HPK", value: `${metrics.binPendingHpk.toLocaleString()} 件`, tone: "text-red-700" },
    { label: "許可済み未搬出", value: `${metrics.permitPendingShipout.toLocaleString()} 件`, tone: "text-amber-700" },
    { label: "配達完了率", value: `${metrics.deliveryCompleteRate.toFixed(1)} %`, tone: "text-blue-700" },
    { label: "持ち戻り件数", value: `${metrics.returnsCount.toLocaleString()} 件`, tone: "text-amber-700" },
    { label: "保留件数", value: `${metrics.holdCount.toLocaleString()} 件`, tone: "text-red-700" },
    { label: "長期滞留件数", value: `${metrics.longAgingCount.toLocaleString()} 件`, tone: "text-red-700" },
  ];

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 mb-2">サマリー</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => (
          <div key={card.label} className={cardStyle}>
            <div className="text-xs text-gray-500">{card.label}</div>
            <div className={`text-xl font-bold mt-1 ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
