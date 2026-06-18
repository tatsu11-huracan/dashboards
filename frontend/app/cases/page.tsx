import Link from "next/link";
import { pool } from "@/lib/db";

type Search = {
  stage?: string;
  status?: string;
  branch?: string;
  q?: string;
};

type BranchFilter = "KIX" | "NRT" | "ALL";

type DbCaseRow = {
  id: string;
  current_stage: string;
  current_status: string;
  customer_name: string;
  branch: string;
  aging_minutes: number;
};

function normalizeBranch(input: string | undefined): BranchFilter {
  return input === "KIX" || input === "NRT" ? input : "ALL";
}

async function getDbCases(branch: BranchFilter): Promise<DbCaseRow[]> {
  const latestResult = await pool.query<{ snapshot_at: string }>(
    `SELECT MAX(snapshot_at) AS snapshot_at
     FROM stage_dwell_snapshot`
  );

  const snapshotAt = latestResult.rows[0]?.snapshot_at;
  if (!snapshotAt) {
    return [];
  }

  const params: unknown[] = [snapshotAt];
  let branchCondition = "";

  if (branch !== "ALL") {
    params.push(branch);
    branchCondition = "AND s.business_location_code = $2";
  }

  const query = `
    SELECT
      CONCAT('DWL-', s.dwell_location_code, '-', ROW_NUMBER() OVER (ORDER BY s.total_count DESC, s.dwell_location_code)) AS id,
      '通関' AS current_stage,
      d.name_ja AS current_status,
      '-' AS customer_name,
      COALESCE(s.business_location_code, '-') AS branch,
      COALESCE(ROUND(s.avg_dwell_minutes), 0)::int AS aging_minutes
    FROM stage_dwell_snapshot s
    JOIN dwell_location_definition d ON d.code = s.dwell_location_code
    WHERE s.snapshot_at = $1
      AND d.category_code = 'CUSTOMS'
      ${branchCondition}
    ORDER BY s.total_count DESC, s.dwell_location_code
    LIMIT 200
  `;

  const result = await pool.query<DbCaseRow>(query, params);
  return result.rows;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams?: Promise<Search>;
}) {
  const sp = await searchParams;
  const stage = sp?.stage ?? "";
  const status = sp?.status ?? "";
  const branch = normalizeBranch(sp?.branch);
  const keyword = sp?.q ?? "";

  const dbCases = await getDbCases(branch);

  const cases = dbCases.filter((item) => {
    const stageOk = stage ? item.current_stage === stage : true;
    const statusOk = status ? item.current_status === status : true;
    const keywordOk =
      keyword.trim().length === 0
        ? true
        : [item.id, item.current_status, item.branch]
            .join(" ")
            .toLowerCase()
            .includes(keyword.trim().toLowerCase());
    return stageOk && statusOk && keywordOk;
  });

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-5 md:px-6 lg:px-8">
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-5 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">案件一覧</h1>
            <p className="text-sm text-gray-500 mt-1">
              条件: {stage || "全工程"} / {status || "全ステータス"}
            </p>
          </div>
          <Link href="/dashboard/customs" className="text-sm text-blue-600 hover:text-blue-800 font-semibold">
            ← 通関ダッシュボードへ戻る
          </Link>
        </div>

        <section className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-600 mb-3">対象件数: {cases.length}件</div>
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="text-gray-600 border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium">案件ID</th>
                  <th className="text-left px-3 py-2 font-medium">工程</th>
                  <th className="text-left px-3 py-2 font-medium">状態</th>
                  <th className="text-left px-3 py-2 font-medium">顧客</th>
                  <th className="text-left px-3 py-2 font-medium">拠点</th>
                  <th className="text-right px-3 py-2 font-medium">滞留(分)</th>
                  <th className="text-left px-3 py-2 font-medium">詳細</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-semibold text-gray-900">{item.id}</td>
                    <td className="px-3 py-2 text-gray-700">{item.current_stage}</td>
                    <td className="px-3 py-2 text-gray-700">{item.current_status}</td>
                    <td className="px-3 py-2 text-gray-700">{item.customer_name}</td>
                    <td className="px-3 py-2 text-gray-700">{item.branch}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{item.aging_minutes}</td>
                    <td className="px-3 py-2">
                      <Link href={`/cases/${item.id}`} className="text-blue-600 hover:text-blue-800 font-semibold">
                        開く
                      </Link>
                    </td>
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
