import Link from "next/link";
import { notFound } from "next/navigation";
import { getCaseById } from "@/lib/mockData";
import { pool } from "@/lib/db";

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
    const dwellMatch = id.match(/^DWL-(.+)-\d+$/);
    const dwellCode = dwellMatch ? dwellMatch[1] : null;

    if (!dwellCode) {
      notFound();
    }

    const latestResult = await pool.query<{ snapshot_at: string }>(
      `SELECT MAX(snapshot_at) AS snapshot_at FROM stage_dwell_snapshot`
    );

    const snapshotAt = latestResult.rows[0]?.snapshot_at;

    if (!snapshotAt) {
      notFound();
    }

    const rowResult = await pool.query<{
      dwell_name: string;
      business_location_code: string | null;
      total_count: number;
      avg_dwell_minutes: number | null;
      p95_dwell_minutes: number | null;
      bucket_24h_count: number;
      bucket_48h_count: number;
      bucket_1w_count: number;
      bucket_2w_count: number;
      bucket_4w_over_count: number;
    }>(
      `SELECT
         d.name_ja AS dwell_name,
         s.business_location_code,
         s.total_count,
         s.avg_dwell_minutes,
         s.p95_dwell_minutes,
         s.bucket_24h_count,
         s.bucket_48h_count,
         s.bucket_1w_count,
         s.bucket_2w_count,
         s.bucket_4w_over_count
       FROM stage_dwell_snapshot s
       JOIN dwell_location_definition d ON d.code = s.dwell_location_code
       WHERE s.snapshot_at = $1
         AND s.dwell_location_code = $2
       ORDER BY s.total_count DESC
       LIMIT 1`,
      [snapshotAt, dwellCode]
    );

    const row = rowResult.rows[0];
    if (!row) {
      notFound();
    }

    return (
      <main className="min-h-screen bg-gray-100 px-4 py-5 md:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto space-y-4">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">案件詳細: {id}</h1>
              <p className="text-sm text-gray-500 mt-1">DBスナップショット由来の通関滞留詳細</p>
            </div>
            <Link href="/cases?stage=通関" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
              ← 案件一覧へ戻る
            </Link>
          </div>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">滞留サマリー</h2>
            <dl className="grid grid-cols-[180px_1fr] gap-y-2 text-sm">
              <dt className="text-gray-500">滞留分類</dt><dd className="text-gray-900">{row.dwell_name}</dd>
              <dt className="text-gray-500">拠点</dt><dd className="text-gray-900">{row.business_location_code ?? "-"}</dd>
              <dt className="text-gray-500">滞留件数</dt><dd className="text-gray-900">{row.total_count}</dd>
              <dt className="text-gray-500">平均滞留(分)</dt><dd className="text-gray-900">{Math.round(row.avg_dwell_minutes ?? 0)}</dd>
              <dt className="text-gray-500">P95滞留(分)</dt><dd className="text-gray-900">{Math.round(row.p95_dwell_minutes ?? 0)}</dd>
            </dl>
          </section>

          <section className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">時間帯分布</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="rounded border border-gray-200 p-3">
                <div className="text-gray-500">24h以内</div>
                <div className="text-lg font-bold text-gray-900">{row.bucket_24h_count}</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-gray-500">48h以内</div>
                <div className="text-lg font-bold text-gray-900">{row.bucket_48h_count}</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-gray-500">1週間以内</div>
                <div className="text-lg font-bold text-gray-900">{row.bucket_1w_count}</div>
              </div>
              <div className="rounded border border-gray-200 p-3">
                <div className="text-gray-500">2週間以内</div>
                <div className="text-lg font-bold text-gray-900">{row.bucket_2w_count}</div>
              </div>
              <div className="rounded border border-red-200 bg-red-50 p-3">
                <div className="text-red-700">4週間超</div>
                <div className="text-lg font-bold text-red-700">{row.bucket_4w_over_count}</div>
              </div>
            </div>
          </section>
        </div>
      </main>
    );
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
