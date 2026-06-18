import { NextResponse } from "next/server";
import { getCustomsOperationalInsights } from "@/lib/customs/operational";
import { pool } from "@/lib/db";

type DwellRow = {
  dwell_code: string;
  dwell_name: string;
  total_count: number;
  avg_dwell_minutes: number | null;
  escalation_after_hours: number | null;
};

type IssueRow = {
  fail_sub_category: string;
  total_count: number;
  bucket_24h_count: number;
};

const STAGE_WEIGHT: Record<string, number> = {
  "未申告在庫（BIN未達）": 4,
  "申告不備在庫": 4,
  "審査対応中（区分2/3）": 3,
  "NACCS準備待ち": 2,
  "クレンジング前滞留": 2,
  "許可済み未搬出": 2,
};

const SEVERITY_WEIGHT = {
  High: 4,
  Medium: 2.5,
  Low: 1,
} as const;

const PRIORITY_COEFFICIENT = {
  agingPerMinute: 0.18,
  severity: 24,
  stage: 14,
  urgency: 20,
};

// issue_aging_snapshotは24h粒度のため、30/60/120分は以下の確定ルールで換算。
// over30: total_countをそのまま採用
// over60: 24h以内件数の72% + 24h超件数
// over120: 24h以内件数の38% + 24h超件数
const AGING_CONVERSION = {
  over60In24hRatio: 0.72,
  over120In24hRatio: 0.38,
};

type Severity = keyof typeof SEVERITY_WEIGHT;

function classifySeverity(row: DwellRow): Severity {
  const avg = row.avg_dwell_minutes ?? 0;
  const escalation = (row.escalation_after_hours ?? 24) * 60;
  if (avg >= escalation * 1.2) return "High";
  if (avg >= escalation * 0.8) return "Medium";
  return "Low";
}

function inferRouteByDwellCode(code: string): "予備審査" | "貨物ルート" {
  if (["CUSTOMS_UNFILED", "CUSTOMS_NACCS_PREP", "CUSTOMS_PRE_CLEANSING"].includes(code)) {
    return "予備審査";
  }

  return "貨物ルート";
}

async function buildFromDatabase() {
  const latestSnapshotResult = await pool.query<{ snapshot_at: string }>(
    `SELECT MAX(snapshot_at) AS snapshot_at
     FROM stage_dwell_snapshot`
  );

  const snapshotAt = latestSnapshotResult.rows[0]?.snapshot_at;
  if (!snapshotAt) {
    return null;
  }

  const dwellRowsResult = await pool.query<DwellRow>(
    `SELECT
       s.dwell_location_code AS dwell_code,
       d.name_ja AS dwell_name,
       SUM(s.total_count)::int AS total_count,
       ROUND(AVG(COALESCE(s.avg_dwell_minutes, 0)))::int AS avg_dwell_minutes,
       MAX(COALESCE(d.escalation_after_hours, 24))::int AS escalation_after_hours
     FROM stage_dwell_snapshot s
     JOIN dwell_location_definition d
       ON d.code = s.dwell_location_code
     WHERE s.snapshot_at = $1
       AND d.category_code = 'CUSTOMS'
       AND s.total_count > 0
     GROUP BY s.dwell_location_code, d.name_ja
     ORDER BY SUM(s.total_count) DESC
     LIMIT 5`,
    [snapshotAt]
  );

  if (dwellRowsResult.rows.length === 0) {
    return null;
  }

  const latestIssueSnapshotResult = await pool.query<{ snapshot_at: string }>(
    `SELECT MAX(snapshot_at) AS snapshot_at
     FROM issue_aging_snapshot`
  );

  const issueSnapshotAt = latestIssueSnapshotResult.rows[0]?.snapshot_at;

  let aging = getCustomsOperationalInsights().aging;

  if (issueSnapshotAt) {
    const issueRowsResult = await pool.query<IssueRow>(
      `SELECT
         fail_sub_category,
         SUM(total_count)::int AS total_count,
         SUM(bucket_24h_count)::int AS bucket_24h_count
       FROM issue_aging_snapshot
       WHERE snapshot_at = $1
         AND issue_kind = 'CUSTOMS_FAIL'
       GROUP BY fail_sub_category`,
      [issueSnapshotAt]
    );

    const unfiledCategories = ["PRE_PROCESS", "PLATFORM_CHECK"];
    const unpermittedCategories = ["DOCUMENT_PREP", "APPLY_IMPOSSIBLE"];

    function summarizeByCategory(categories: string[]) {
      const rows = issueRowsResult.rows.filter((row) => categories.includes(row.fail_sub_category));
      const total = rows.reduce((sum, row) => sum + row.total_count, 0);
      const in24h = rows.reduce((sum, row) => sum + row.bucket_24h_count, 0);
      const over24h = Math.max(0, total - in24h);

      const over30 = total;
      const over60 = Math.min(
        total,
        Math.round(over24h + in24h * AGING_CONVERSION.over60In24hRatio)
      );
      const over120 = Math.min(
        total,
        Math.round(over24h + in24h * AGING_CONVERSION.over120In24hRatio)
      );

      return {
        over30,
        over60,
        over120,
      };
    }

    const unfiled = summarizeByCategory(unfiledCategories);
    const unpermitted = summarizeByCategory(unpermittedCategories);

    aging = [
      {
        label: "未申告在庫",
        over30: unfiled.over30,
        over60: unfiled.over60,
        over120: unfiled.over120,
      },
      {
        label: "未許可在庫",
        over30: unpermitted.over30,
        over60: unpermitted.over60,
        over120: unpermitted.over120,
      },
    ];
  }

  const priorityQueue = dwellRowsResult.rows.map((row) => {
    const severity = classifySeverity(row);
    const avg = row.avg_dwell_minutes ?? 0;
    const stageWeight = STAGE_WEIGHT[row.dwell_name] ?? 1;
    const toCutoffMin = Math.max(0, 240 - Math.floor(avg / 6));
    const urgency = toCutoffMin <= 60 ? 3 : toCutoffMin <= 120 ? 2 : 1;
    const score = Math.round(
      avg * PRIORITY_COEFFICIENT.agingPerMinute +
        SEVERITY_WEIGHT[severity] * PRIORITY_COEFFICIENT.severity +
        stageWeight * PRIORITY_COEFFICIENT.stage +
        urgency * PRIORITY_COEFFICIENT.urgency
    );

    return {
      caseId: row.dwell_code,
      route: inferRouteByDwellCode(row.dwell_code),
      stage: row.dwell_name,
      dwellMin: avg,
      toCutoffMin,
      severity,
      score,
    };
  }).sort((a, b) => b.score - a.score);

  return {
    formula: {
      scoreFormula:
        "score = 平均滞留分×0.18 + 重症度係数×24 + 工程重み×14 + 締切逼迫係数×20",
      weights: {
        severity: SEVERITY_WEIGHT,
        stage: STAGE_WEIGHT,
      },
    },
    aging,
    priorityQueue,
    generatedAt: snapshotAt,
  };
}

export async function GET() {
  const data = (await buildFromDatabase()) ?? getCustomsOperationalInsights();
  return NextResponse.json(data);
}
