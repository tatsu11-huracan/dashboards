import { mockCases, type CaseDetail } from "@/lib/mockData";

export type AlertSeverity = "High" | "Medium" | "Low";

export type PriorityQueueItem = {
  caseId: string;
  route: "予備審査" | "貨物ルート";
  stage: string;
  dwellMin: number;
  toCutoffMin: number;
  severity: AlertSeverity;
  score: number;
};

export type AgingBreakdown = {
  label: string;
  over30: number;
  over60: number;
  over120: number;
};

export type OperationalInsights = {
  formula: {
    scoreFormula: string;
    weights: {
      severity: Record<AlertSeverity, number>;
      stage: Record<string, number>;
    };
  };
  aging: AgingBreakdown[];
  priorityQueue: PriorityQueueItem[];
  generatedAt: string;
};

const SEVERITY_WEIGHT: Record<AlertSeverity, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

const STAGE_WEIGHT: Record<string, number> = {
  "HS確認待ち": 3,
  "クレンジング中": 2,
  "未許可": 3,
  "区分2": 2,
  "区分3": 2,
  "申告済": 2,
};

function classifySeverity(caseItem: CaseDetail): AlertSeverity {
  if (caseItem.agingMinutes >= 120 || caseItem.currentStatus === "未許可") {
    return "High";
  }

  if (caseItem.agingMinutes >= 60 || ["区分2", "区分3"].includes(caseItem.currentStatus)) {
    return "Medium";
  }

  return "Low";
}

function inferRoute(caseItem: CaseDetail): "予備審査" | "貨物ルート" {
  const prelimStatuses = ["データ未着", "HS確認待ち", "クレンジング中", "申告済", "区分1", "区分2", "区分3", "未許可"];
  return prelimStatuses.includes(caseItem.currentStatus) ? "予備審査" : "貨物ルート";
}

function calcToCutoffMinutes(caseItem: CaseDetail): number {
  // MVP: 通関締切240分を想定し、滞留時間から残り時間を簡易算出
  return Math.max(0, 240 - Math.floor(caseItem.agingMinutes / 6));
}

function buildPriorityQueue(cases: CaseDetail[]): PriorityQueueItem[] {
  return cases
    .filter((item) => item.currentStage === "通関" && item.isException)
    .map((item) => {
      const severity = classifySeverity(item);
      const stageWeight = STAGE_WEIGHT[item.currentStatus] ?? 1;
      const toCutoffMin = calcToCutoffMinutes(item);
      const urgency = toCutoffMin <= 60 ? 3 : toCutoffMin <= 120 ? 2 : 1;
      const score =
        item.agingMinutes * 0.2 +
        SEVERITY_WEIGHT[severity] * 20 +
        stageWeight * 12 +
        urgency * 15;

      return {
        caseId: item.id,
        route: inferRoute(item),
        stage: item.currentStatus,
        dwellMin: item.agingMinutes,
        toCutoffMin,
        severity,
        score: Math.round(score),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function buildAging(cases: CaseDetail[]): AgingBreakdown[] {
  const undeclaredTargets = cases.filter(
    (item) => item.currentStage === "通関" && ["データ未着", "HS確認待ち", "クレンジング中"].includes(item.currentStatus)
  );

  const unpermittedTargets = cases.filter(
    (item) => item.currentStage === "通関" && ["未許可", "区分2", "区分3"].includes(item.currentStatus)
  );

  const rows = [
    { label: "未申告在庫", items: undeclaredTargets },
    { label: "未許可在庫", items: unpermittedTargets },
  ];

  return rows.map((row) => ({
    label: row.label,
    over30: row.items.filter((item) => item.agingMinutes >= 30).length,
    over60: row.items.filter((item) => item.agingMinutes >= 60).length,
    over120: row.items.filter((item) => item.agingMinutes >= 120).length,
  }));
}

export function getCustomsOperationalInsights(sourceCases: CaseDetail[] = mockCases): OperationalInsights {
  return {
    formula: {
      scoreFormula: "score = 滞留分×0.2 + 重症度係数×20 + 工程重み×12 + 締切逼迫係数×15",
      weights: {
        severity: SEVERITY_WEIGHT,
        stage: STAGE_WEIGHT,
      },
    },
    aging: buildAging(sourceCases),
    priorityQueue: buildPriorityQueue(sourceCases),
    generatedAt: new Date().toISOString(),
  };
}
