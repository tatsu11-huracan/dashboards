type Status = "normal" | "warning" | "critical";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  target?: string | number;
  targetLabel?: string;
  status?: Status;
  sub?: string;
  highlight?: boolean;
};

const statusBg: Record<Status, string> = {
  normal: "bg-white border-l-4 border-l-blue-500",
  warning: "bg-white border-l-4 border-l-amber-400",
  critical: "bg-white border-l-4 border-l-red-500",
};

const statusValueColor: Record<Status, string> = {
  normal: "text-gray-900",
  warning: "text-amber-600",
  critical: "text-red-600",
};

export default function KpiCard({
  label,
  value,
  unit,
  target,
  targetLabel = "目標",
  status = "normal",
  sub,
  highlight,
}: Props) {
  return (
    <div
      className={`${statusBg[status]} rounded-lg shadow-sm p-4 flex flex-col gap-1 ${highlight ? "ring-2 ring-blue-400" : ""}`}
    >
      <span className="text-xs text-gray-500 font-medium truncate">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`text-2xl font-bold ${statusValueColor[status]}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
      {target !== undefined && (
        <span className="text-xs text-gray-400">
          {targetLabel}: {typeof target === "number" ? target.toLocaleString() : target}
          {unit && unit}
        </span>
      )}
      {sub && <span className="text-xs text-gray-500 mt-0.5">{sub}</span>}
    </div>
  );
}
