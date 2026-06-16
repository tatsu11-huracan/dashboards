import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseById } from "@/lib/mockData";

function formatAging(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const caseItem = getCaseById(id);

  if (!caseItem) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-5 md:px-6 lg:px-8">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">案件詳細: {caseItem.id}</h1>
            <p className="text-sm text-gray-500 mt-1">状態履歴・異常理由・次アクション</p>
          </div>
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
            ← 全体ダッシュボードに戻る
          </Link>
        </div>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">基本情報</h2>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">マスター番号</dt><dd className="text-gray-900">{caseItem.masterNo}</dd>
              <dt className="text-gray-500">ハウス番号</dt><dd className="text-gray-900">{caseItem.houseNo}</dd>
              <dt className="text-gray-500">顧客名</dt><dd className="text-gray-900">{caseItem.customerName}</dd>
              <dt className="text-gray-500">拠点</dt><dd className="text-gray-900">{caseItem.branch}</dd>
              <dt className="text-gray-500">担当部署 / 担当者</dt><dd className="text-gray-900">{caseItem.department} / {caseItem.assignee}</dd>
              <dt className="text-gray-500">更新時刻</dt><dd className="text-gray-900">{caseItem.updatedAt}</dd>
            </dl>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">現在状態</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                <span className="text-sm text-gray-500">現在工程</span>
                <span className="text-sm font-semibold text-gray-900">{caseItem.currentStage}</span>
              </div>
              <div className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                <span className="text-sm text-gray-500">現在ステータス</span>
                <span className={`text-sm font-semibold ${caseItem.isException ? "text-red-700" : "text-gray-900"}`}>
                  {caseItem.currentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                <span className="text-sm text-gray-500">滞留時間</span>
                <span className={`text-sm font-semibold ${caseItem.agingMinutes >= 24 * 60 ? "text-red-700" : "text-gray-900"}`}>
                  {formatAging(caseItem.agingMinutes)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">異常理由</h2>
            {caseItem.exceptionReasons.length === 0 ? (
              <p className="text-sm text-gray-500">異常なし</p>
            ) : (
              <ul className="space-y-2">
                {caseItem.exceptionReasons.map((reason) => (
                  <li key={reason} className="px-3 py-2 bg-red-50 border border-red-100 rounded text-sm text-red-700 font-medium">
                    {reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">次アクション</h2>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded text-sm text-amber-800">
              {caseItem.nextAction}
            </div>
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">ステータス履歴</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-gray-600 border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium">時刻</th>
                  <th className="text-left px-3 py-2 font-medium">工程</th>
                  <th className="text-left px-3 py-2 font-medium">ステータス</th>
                  <th className="text-left px-3 py-2 font-medium">メモ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {caseItem.stageHistory.map((h, idx) => (
                  <tr key={`${h.at}-${idx}`}>
                    <td className="px-3 py-2 text-gray-700">{h.at}</td>
                    <td className="px-3 py-2 text-gray-700">{h.stage}</td>
                    <td className="px-3 py-2 text-gray-900 font-medium">{h.status}</td>
                    <td className="px-3 py-2 text-gray-600">{h.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
