export type Stage = "通関" | "保税" | "配送";
export type BranchCode = "KIX" | "NRT";
export type BranchFilter = BranchCode | "ALL";

export type CaseRecord = {
  id: string;
  currentStage: Stage;
  currentStatus: string;
  isException: boolean;
  masterNo: string;
  houseNo: string;
  customerName: string;
  branch: BranchCode;
  department: string;
  assignee: string;
  updatedAt: string;
  agingMinutes: number;
};

export type CaseHistory = {
  at: string;
  stage: Stage;
  status: string;
  note?: string;
};

export type CaseDetail = CaseRecord & {
  exceptionReasons: string[];
  nextAction: string;
  stageHistory: CaseHistory[];
};

export type SummaryMetrics = {
  todayTarget: number;
  undeclared: number;
  binPendingHpk: number;
  permitPendingShipout: number;
  deliveryCompleteRate: number;
  returnsCount: number;
  holdCount: number;
  longAgingCount: number;
};

export type ProcessSection = {
  title: string;
  statuses: { name: string; count: number }[];
};

export type ExceptionItem = {
  key: string;
  label: string;
  count: number;
};

export const CUSTOMS_STATUSES = [
  "データ未着",
  "HS確認待ち",
  "クレンジング中",
  "申告済",
  "区分1",
  "区分2",
  "区分3",
  "許可済",
  "未許可",
] as const;

export const BONDED_STATUSES = [
  "PKG済み",
  "OUT済み",
  "BIN済み",
  "HPK済み",
  "許可済未搬出",
  "搬出済み",
  "保留ゾーン",
  "長期滞留",
] as const;

export const DELIVERY_STATUSES = [
  "引渡済み",
  "仕分け待ち",
  "積込済み",
  "配達中",
  "配達完了",
  "持ち戻り",
  "住所不備",
  "破損",
] as const;

export const mockCases: CaseDetail[] = [
  {
    id: "C-1001",
    currentStage: "通関",
    currentStatus: "HS確認待ち",
    isException: true,
    masterNo: "MAWB-240601-001",
    houseNo: "HAWB-7788121",
    customerName: "ABC Trading",
    branch: "KIX",
    department: "通関1課",
    assignee: "山田",
    updatedAt: "2026-06-16 08:15",
    agingMinutes: 680,
    exceptionReasons: ["未申告", "申告前不備"],
    nextAction: "HSコード確認後に申告へ進める",
    stageHistory: [
      { at: "2026-06-15 19:30", stage: "通関", status: "データ未着" },
      { at: "2026-06-16 07:40", stage: "通関", status: "HS確認待ち", note: "品目情報不足" },
    ],
  },
  {
    id: "C-1002",
    currentStage: "通関",
    currentStatus: "区分2",
    isException: true,
    masterNo: "MAWB-240601-002",
    houseNo: "HAWB-7788122",
    customerName: "Nexus EC",
    branch: "NRT",
    department: "通関2課",
    assignee: "佐藤",
    updatedAt: "2026-06-16 08:02",
    agingMinutes: 530,
    exceptionReasons: ["区分2/3"],
    nextAction: "追加書類提出状況を税関へ確認",
    stageHistory: [
      { at: "2026-06-16 02:15", stage: "通関", status: "申告済" },
      { at: "2026-06-16 06:10", stage: "通関", status: "区分2" },
    ],
  },
  {
    id: "C-1003",
    currentStage: "保税",
    currentStatus: "BIN済み",
    isException: true,
    masterNo: "MAWB-240601-003",
    houseNo: "HAWB-7788123",
    customerName: "Global Mart",
    branch: "KIX",
    department: "保税",
    assignee: "田中",
    updatedAt: "2026-06-16 07:58",
    agingMinutes: 910,
    exceptionReasons: ["BIN済み未HPK"],
    nextAction: "申告/マニフェスト突合の遅延要因を解消",
    stageHistory: [
      { at: "2026-06-16 03:11", stage: "保税", status: "OUT済み" },
      { at: "2026-06-16 04:20", stage: "保税", status: "BIN済み" },
    ],
  },
  {
    id: "C-1004",
    currentStage: "保税",
    currentStatus: "許可済未搬出",
    isException: true,
    masterNo: "MAWB-240601-004",
    houseNo: "HAWB-7788124",
    customerName: "TEMU JP",
    branch: "NRT",
    department: "保税",
    assignee: "高橋",
    updatedAt: "2026-06-16 07:25",
    agingMinutes: 1210,
    exceptionReasons: ["許可済み未搬出"],
    nextAction: "搬出枠の再調整と配車連携",
    stageHistory: [
      { at: "2026-06-16 01:05", stage: "通関", status: "許可済" },
      { at: "2026-06-16 02:40", stage: "保税", status: "許可済未搬出" },
    ],
  },
  {
    id: "C-1005",
    currentStage: "保税",
    currentStatus: "保留ゾーン",
    isException: true,
    masterNo: "MAWB-240601-005",
    houseNo: "HAWB-7788125",
    customerName: "Shopline",
    branch: "KIX",
    department: "保税",
    assignee: "渡辺",
    updatedAt: "2026-06-16 06:10",
    agingMinutes: 2980,
    exceptionReasons: ["保留ゾーン", "長期滞留"],
    nextAction: "保留理由の解消期限を設定してCS連携",
    stageHistory: [
      { at: "2026-06-15 08:30", stage: "保税", status: "HPK済み" },
      { at: "2026-06-15 09:20", stage: "保税", status: "保留ゾーン", note: "書類不備" },
    ],
  },
  {
    id: "C-1006",
    currentStage: "配送",
    currentStatus: "持ち戻り",
    isException: true,
    masterNo: "MAWB-240601-006",
    houseNo: "HAWB-7788126",
    customerName: "TikTok Shop",
    branch: "NRT",
    department: "配送",
    assignee: "配送A社",
    updatedAt: "2026-06-16 08:19",
    agingMinutes: 430,
    exceptionReasons: ["持ち戻り"],
    nextAction: "再配達枠の確保と顧客連絡",
    stageHistory: [
      { at: "2026-06-16 05:05", stage: "配送", status: "配達中" },
      { at: "2026-06-16 07:55", stage: "配送", status: "持ち戻り", note: "不在" },
    ],
  },
  {
    id: "C-1007",
    currentStage: "配送",
    currentStatus: "住所不備",
    isException: true,
    masterNo: "MAWB-240601-007",
    houseNo: "HAWB-7788127",
    customerName: "YY Imports",
    branch: "KIX",
    department: "配送",
    assignee: "配送B社",
    updatedAt: "2026-06-16 08:05",
    agingMinutes: 980,
    exceptionReasons: ["住所不備"],
    nextAction: "住所補正後に再配達指示",
    stageHistory: [
      { at: "2026-06-16 02:35", stage: "配送", status: "配達中" },
      { at: "2026-06-16 04:40", stage: "配送", status: "住所不備" },
    ],
  },
  {
    id: "C-1008",
    currentStage: "配送",
    currentStatus: "破損",
    isException: true,
    masterNo: "MAWB-240601-008",
    houseNo: "HAWB-7788128",
    customerName: "Prime Retail",
    branch: "NRT",
    department: "配送",
    assignee: "配送C社",
    updatedAt: "2026-06-16 07:42",
    agingMinutes: 740,
    exceptionReasons: ["破損"],
    nextAction: "保険処理と代替配送を手配",
    stageHistory: [
      { at: "2026-06-16 03:50", stage: "配送", status: "積込済み" },
      { at: "2026-06-16 06:15", stage: "配送", status: "破損", note: "梱包破れ" },
    ],
  },
  {
    id: "C-1009",
    currentStage: "通関",
    currentStatus: "区分1",
    isException: false,
    masterNo: "MAWB-240601-009",
    houseNo: "HAWB-7788129",
    customerName: "Blue Cargo",
    branch: "KIX",
    department: "通関2課",
    assignee: "中村",
    updatedAt: "2026-06-16 08:11",
    agingMinutes: 210,
    exceptionReasons: [],
    nextAction: "許可後に保税引き渡し",
    stageHistory: [
      { at: "2026-06-16 05:30", stage: "通関", status: "申告済" },
      { at: "2026-06-16 07:50", stage: "通関", status: "区分1" },
    ],
  },
  {
    id: "C-1010",
    currentStage: "保税",
    currentStatus: "搬出済み",
    isException: false,
    masterNo: "MAWB-240601-010",
    houseNo: "HAWB-7788130",
    customerName: "Fast Box",
    branch: "NRT",
    department: "保税",
    assignee: "小林",
    updatedAt: "2026-06-16 07:40",
    agingMinutes: 160,
    exceptionReasons: [],
    nextAction: "配送部へ引渡し完了確認",
    stageHistory: [
      { at: "2026-06-16 04:05", stage: "保税", status: "HPK済み" },
      { at: "2026-06-16 07:25", stage: "保税", status: "搬出済み" },
    ],
  },
  {
    id: "C-1011",
    currentStage: "配送",
    currentStatus: "配達完了",
    isException: false,
    masterNo: "MAWB-240601-011",
    houseNo: "HAWB-7788131",
    customerName: "Sunrise LLC",
    branch: "KIX",
    department: "配送",
    assignee: "配送D社",
    updatedAt: "2026-06-16 07:12",
    agingMinutes: 70,
    exceptionReasons: [],
    nextAction: "完了",
    stageHistory: [
      { at: "2026-06-16 04:15", stage: "配送", status: "配達中" },
      { at: "2026-06-16 06:58", stage: "配送", status: "配達完了" },
    ],
  },
  {
    id: "C-1012",
    currentStage: "通関",
    currentStatus: "未許可",
    isException: true,
    masterNo: "MAWB-240601-012",
    houseNo: "HAWB-7788132",
    customerName: "Mega Select",
    branch: "NRT",
    department: "通関1課",
    assignee: "井上",
    updatedAt: "2026-06-16 08:22",
    agingMinutes: 1180,
    exceptionReasons: ["未許可", "長期滞留"],
    nextAction: "税関照会回答後に再判定",
    stageHistory: [
      { at: "2026-06-16 01:45", stage: "通関", status: "申告済" },
      { at: "2026-06-16 03:10", stage: "通関", status: "未許可" },
    ],
  },
];

const LONG_AGING_THRESHOLD_MINUTES = 24 * 60;

function initCounter(keys: readonly string[]) {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<string, number>;
}

export function getCases(branch: BranchFilter, keyword: string) {
  const q = keyword.trim().toLowerCase();
  return mockCases.filter((item) => {
    const branchMatched = branch === "ALL" ? true : item.branch === branch;
    const keywordMatched =
      q.length === 0
        ? true
        : [item.masterNo, item.houseNo, item.id, item.customerName].some((field) =>
            field.toLowerCase().includes(q),
          );
    return branchMatched && keywordMatched;
  });
}

export function getCaseById(id: string) {
  return mockCases.find((item) => item.id === id);
}

export function getSummaryMetrics(cases: CaseRecord[]): SummaryMetrics {
  const deliveryTotal = cases.filter((item) => item.currentStage === "配送").length;
  const deliveryCompleted = cases.filter(
    (item) => item.currentStage === "配送" && item.currentStatus === "配達完了",
  ).length;

  return {
    todayTarget: cases.length,
    undeclared: cases.filter(
      (item) =>
        item.currentStage === "通関" && ["データ未着", "HS確認待ち", "クレンジング中"].includes(item.currentStatus),
    ).length,
    binPendingHpk: cases.filter(
      (item) => item.currentStage === "保税" && item.currentStatus === "BIN済み",
    ).length,
    permitPendingShipout: cases.filter(
      (item) => item.currentStage === "保税" && item.currentStatus === "許可済未搬出",
    ).length,
    deliveryCompleteRate: deliveryTotal === 0 ? 0 : (deliveryCompleted / deliveryTotal) * 100,
    returnsCount: cases.filter((item) => item.currentStatus === "持ち戻り").length,
    holdCount: cases.filter((item) => ["保留ゾーン", "未許可"].includes(item.currentStatus)).length,
    longAgingCount: cases.filter((item) => item.agingMinutes >= LONG_AGING_THRESHOLD_MINUTES).length,
  };
}

export function getProcessSections(cases: CaseRecord[]): ProcessSection[] {
  const customs = initCounter(CUSTOMS_STATUSES);
  const bonded = initCounter(BONDED_STATUSES);
  const delivery = initCounter(DELIVERY_STATUSES);

  for (const item of cases) {
    if (item.currentStage === "通関" && customs[item.currentStatus] !== undefined) customs[item.currentStatus] += 1;
    if (item.currentStage === "保税" && bonded[item.currentStatus] !== undefined) bonded[item.currentStatus] += 1;
    if (item.currentStage === "配送" && delivery[item.currentStatus] !== undefined) delivery[item.currentStatus] += 1;
  }

  return [
    { title: "通関", statuses: CUSTOMS_STATUSES.map((name) => ({ name, count: customs[name] ?? 0 })) },
    { title: "保税", statuses: BONDED_STATUSES.map((name) => ({ name, count: bonded[name] ?? 0 })) },
    { title: "配送", statuses: DELIVERY_STATUSES.map((name) => ({ name, count: delivery[name] ?? 0 })) },
  ];
}

export function getExceptionItems(cases: CaseRecord[]): ExceptionItem[] {
  return [
    {
      key: "undeclared",
      label: "未申告",
      count: cases.filter(
        (item) =>
          item.currentStage === "通関" && ["データ未着", "HS確認待ち", "クレンジング中"].includes(item.currentStatus),
      ).length,
    },
    {
      key: "kubun23",
      label: "区分2/3",
      count: cases.filter((item) => ["区分2", "区分3"].includes(item.currentStatus)).length,
    },
    {
      key: "binPendingHpk",
      label: "BIN済み未HPK",
      count: cases.filter((item) => item.currentStage === "保税" && item.currentStatus === "BIN済み").length,
    },
    {
      key: "unpermitted",
      label: "未許可",
      count: cases.filter((item) => item.currentStatus === "未許可").length,
    },
    {
      key: "holdZone",
      label: "保留ゾーン",
      count: cases.filter((item) => item.currentStatus === "保留ゾーン").length,
    },
    {
      key: "longAging",
      label: "長期滞留",
      count: cases.filter((item) => item.agingMinutes >= LONG_AGING_THRESHOLD_MINUTES).length,
    },
    {
      key: "returns",
      label: "持ち戻り",
      count: cases.filter((item) => item.currentStatus === "持ち戻り").length,
    },
    {
      key: "address",
      label: "住所不備",
      count: cases.filter((item) => item.currentStatus === "住所不備").length,
    },
    {
      key: "damage",
      label: "破損",
      count: cases.filter((item) => item.currentStatus === "破損").length,
    },
  ];
}
