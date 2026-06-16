import type { ProcessSection } from "@/lib/mockData";

type Props = {
  sections: ProcessSection[];
};

const dangerStatuses = new Set([
  "区分2",
  "区分3",
  "未許可",
  "BIN済み",
  "許可済未搬出",
  "保留ゾーン",
  "長期滞留",
  "持ち戻り",
  "住所不備",
  "破損",
]);

export default function ProcessFlowPanel({ sections }: Props) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">工程別可視化（通関 → 保税 → 配送）</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <div key={section.title} className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
              <div className="text-sm font-semibold text-gray-800">{section.title}</div>
            </div>
            <div className="divide-y divide-gray-100">
              {section.statuses.map((status) => {
                const isDanger = dangerStatuses.has(status.name) && status.count > 0;
                return (
                  <div key={status.name} className="px-3 py-2 flex items-center justify-between">
                    <span className={`text-sm ${isDanger ? "text-red-700 font-medium" : "text-gray-700"}`}>
                      {status.name}
                    </span>
                    <span className={`text-sm font-semibold ${isDanger ? "text-red-700" : "text-gray-900"}`}>
                      {status.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
