import type { ExceptionItem } from "@/lib/mockData";

type Props = {
  items: ExceptionItem[];
};

export default function ExceptionPanel({ items }: Props) {
  return (
    <section className="bg-red-50 border border-red-200 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-red-800 mb-3">異常・滞留パネル（優先対応）</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {items.map((item) => (
          <div key={item.key} className="bg-white border border-red-100 rounded-md px-3 py-2">
            <div className="text-xs text-gray-600">{item.label}</div>
            <div className={`text-lg font-bold mt-0.5 ${item.count > 0 ? "text-red-700" : "text-gray-400"}`}>
              {item.count}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
