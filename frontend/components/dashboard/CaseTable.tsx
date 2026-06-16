import Link from "next/link";
import type { CaseRecord } from "@/lib/mockData";

type Props = {
  cases: CaseRecord[];
};

function formatAging(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function CaseTable({ cases }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">案件一覧</h2>
        <span className="text-xs text-gray-500">{cases.length.toLocaleString()} 件</span>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm min-w-[1100px]">
          <thead>
            <tr className="text-gray-600 border-b border-gray-200 bg-gray-50">
              <th className="text-left px-3 py-2 font-medium">現在工程</th>
              <th className="text-left px-3 py-2 font-medium">現在ステータス</th>
              <th className="text-left px-3 py-2 font-medium">マスター番号</th>
              <th className="text-left px-3 py-2 font-medium">ハウス番号</th>
              <th className="text-left px-3 py-2 font-medium">顧客名</th>
              <th className="text-left px-3 py-2 font-medium">拠点</th>
              <th className="text-left px-3 py-2 font-medium">担当部署</th>
              <th className="text-left px-3 py-2 font-medium">更新時刻</th>
              <th className="text-right px-3 py-2 font-medium">滞留時間</th>
              <th className="text-center px-3 py-2 font-medium">異常有無</th>
              <th className="text-center px-3 py-2 font-medium">詳細</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cases.map((item) => (
              <tr key={item.id} className={item.isException ? "bg-red-50/40" : ""}>
                <td className="px-3 py-2 text-gray-800">{item.currentStage}</td>
                <td className={`px-3 py-2 ${item.isException ? "text-red-700 font-medium" : "text-gray-800"}`}>
                  {item.currentStatus}
                </td>
                <td className="px-3 py-2 text-gray-700">{item.masterNo}</td>
                <td className="px-3 py-2 text-gray-700">{item.houseNo}</td>
                <td className="px-3 py-2 text-gray-700">{item.customerName}</td>
                <td className="px-3 py-2 text-gray-700">{item.branch}</td>
                <td className="px-3 py-2 text-gray-700">{item.department}</td>
                <td className="px-3 py-2 text-gray-700">{item.updatedAt}</td>
                <td className={`px-3 py-2 text-right ${item.agingMinutes >= 24 * 60 ? "text-red-700 font-semibold" : "text-gray-700"}`}>
                  {formatAging(item.agingMinutes)}
                </td>
                <td className="px-3 py-2 text-center">
                  {item.isException ? (
                    <span className="inline-flex px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-semibold">異常</span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-500 text-xs">正常</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <Link
                    href={`/cases/${item.id}`}
                    className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                  >
                    開く
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
