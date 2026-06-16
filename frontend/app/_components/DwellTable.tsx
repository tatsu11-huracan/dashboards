type BucketCount = {
  total: number;
  b24h: number;
  b48h: number;
  b1w: number;
  b2w: number;
  b4wUnder: number;
  b4wOver: number;
};

export type DwellRow = {
  name: string;
  exitCondition?: string;
  counts: BucketCount;
};

type Props = {
  rows: DwellRow[];
  title?: string;
};

function cellClass(value: number, isCritical: boolean): string {
  if (value === 0) return "text-gray-300";
  if (isCritical && value > 0) return "font-bold text-red-600";
  if (value >= 10) return "font-semibold text-amber-600";
  return "text-gray-700";
}

export default function DwellTable({ rows, title }: Props) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="px-4 py-2 text-left font-medium">滞留場所</th>
              <th className="px-3 py-2 text-right font-medium">合計</th>
              <th className="px-3 py-2 text-right font-medium">24h</th>
              <th className="px-3 py-2 text-right font-medium">48h</th>
              <th className="px-3 py-2 text-right font-medium">1週</th>
              <th className="px-3 py-2 text-right font-medium">2週</th>
              <th className="px-3 py-2 text-right font-medium">4週未満</th>
              <th className="px-3 py-2 text-right font-medium text-red-500">4週以上</th>
              <th className="px-4 py-2 text-left font-medium">解消条件</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-gray-800 font-medium whitespace-nowrap">
                  {row.name}
                </td>
                <td className={`px-3 py-2.5 text-right font-semibold ${row.counts.total > 0 ? "text-gray-900" : "text-gray-300"}`}>
                  {row.counts.total}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b24h, false)}`}>
                  {row.counts.b24h || "-"}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b48h, false)}`}>
                  {row.counts.b48h || "-"}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b1w, false)}`}>
                  {row.counts.b1w || "-"}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b2w, false)}`}>
                  {row.counts.b2w || "-"}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b4wUnder, false)}`}>
                  {row.counts.b4wUnder || "-"}
                </td>
                <td className={`px-3 py-2.5 text-right ${cellClass(row.counts.b4wOver, true)}`}>
                  {row.counts.b4wOver > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                      {row.counts.b4wOver}
                    </span>
                  ) : "-"}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-400 max-w-48 truncate">
                  {row.exitCondition ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
