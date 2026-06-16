export type FlowStep = {
  code: string;
  name: string;
  dwellCount?: number;
  isTerminal?: boolean;
  status?: "normal" | "warning" | "critical";
};

type Props = {
  steps: FlowStep[];
  terminalSteps?: { code: string; name: string; count: number }[];
};

function nodeColor(step: FlowStep): string {
  if (step.isTerminal) return "bg-gray-100 border-gray-300 text-gray-500";
  const count = step.dwellCount ?? 0;
  if (step.status === "critical" || count >= 30) return "bg-red-50 border-red-300";
  if (step.status === "warning" || count >= 10) return "bg-amber-50 border-amber-300";
  return "bg-blue-50 border-blue-200";
}

function dwellBadgeColor(step: FlowStep): string {
  const count = step.dwellCount ?? 0;
  if (count >= 30) return "bg-red-500 text-white";
  if (count >= 10) return "bg-amber-400 text-white";
  if (count > 0) return "bg-blue-500 text-white";
  return "bg-gray-200 text-gray-500";
}

export default function FlowDiagram({ steps, terminalSteps }: Props) {
  const mainSteps = steps.filter((s) => !s.isTerminal);

  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">業務フロー滞留状況</h3>

      {/* Main flow */}
      <div className="flex items-center gap-0 flex-wrap">
        {mainSteps.map((step, i) => (
          <div key={step.code} className="flex items-center">
            <div
              className={`relative border rounded-lg px-3 py-2 min-w-20 text-center ${nodeColor(step)}`}
            >
              <div className="text-[10px] text-gray-400 font-mono">{step.code}</div>
              <div className="text-xs font-medium text-gray-800 leading-tight mt-0.5">
                {step.name}
              </div>
              {step.dwellCount !== undefined && (
                <div className="mt-1.5 flex justify-center">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-bold rounded-full w-6 h-6 ${dwellBadgeColor(step)}`}
                  >
                    {step.dwellCount}
                  </span>
                </div>
              )}
            </div>
            {i < mainSteps.length - 1 && (
              <div className="flex items-center px-1">
                <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
                  <path d="M0 7h16M12 2l8 5-8 5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Terminal steps */}
      {terminalSteps && terminalSteps.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">終了系:</span>
            {terminalSteps.map((t) => (
              <span
                key={t.code}
                className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full"
              >
                {t.name}
                {t.count > 0 && (
                  <span className="bg-gray-400 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {t.count}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-gray-50 flex gap-3">
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-red-500" /> 30件以上
        </span>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-amber-400" /> 10件以上
        </span>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> 10件未満
        </span>
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-full bg-gray-200" /> 0件
        </span>
      </div>
    </div>
  );
}
