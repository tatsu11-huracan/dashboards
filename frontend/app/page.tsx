import DashboardHeader from "@/components/dashboard/DashboardHeader";
import FilterBar from "@/components/dashboard/FilterBar";
import SummaryCards from "@/components/dashboard/SummaryCards";
import ProcessFlowPanel from "@/components/dashboard/ProcessFlowPanel";
import ExceptionPanel from "@/components/dashboard/ExceptionPanel";
import CaseTable from "@/components/dashboard/CaseTable";
import {
  getCases,
  getExceptionItems,
  getProcessSections,
  getSummaryMetrics,
  type BranchFilter,
} from "@/lib/mockData";

function normalizeBranch(input: string | undefined): BranchFilter {
  return input === "KIX" || input === "NRT" ? input : "ALL";
}

export default async function OverallDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ branch?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const branch = normalizeBranch(sp?.branch);
  const keyword = sp?.q ?? "";

  const cases = getCases(branch, keyword);
  const summary = getSummaryMetrics(cases);
  const processSections = getProcessSections(cases);
  const exceptionItems = getExceptionItems(cases);

  const now = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-5 md:px-6 lg:px-8">
      <div className="max-w-[1440px] mx-auto space-y-4">
        <DashboardHeader
          title="全体ダッシュボード"
          subtitle={`通関・保税・配送の状態ベース監視 ｜ 更新: ${now}`}
        />

        <FilterBar branch={branch} keyword={keyword} />
        <SummaryCards metrics={summary} />
        <ProcessFlowPanel sections={processSections} />
        <ExceptionPanel items={exceptionItems} />
        <CaseTable cases={cases} />
      </div>
    </main>
  );
}
