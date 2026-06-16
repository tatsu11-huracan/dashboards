import Link from "next/link";
import type { BranchFilter } from "@/lib/mockData";

type Props = {
  branch: BranchFilter;
  keyword: string;
};

export default function FilterBar({ branch, keyword }: Props) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-semibold text-gray-700">部門画面:</span>
        <Link href="/dashboard/customs" className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">通関部</Link>
        <Link href="/dashboard/bonded" className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">保税部</Link>
        <Link href="/dashboard/delivery" className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">配送部</Link>
      </div>

      <form method="GET" className="grid grid-cols-1 md:grid-cols-[180px_1fr_120px] gap-3">
        <div>
          <label htmlFor="branch" className="block text-xs font-medium text-gray-600 mb-1">拠点切替</label>
          <select
            id="branch"
            name="branch"
            defaultValue={branch}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
          >
            <option value="ALL">全拠点</option>
            <option value="KIX">関西/関空 (KIX)</option>
            <option value="NRT">関東/成田 (NRT)</option>
          </select>
        </div>

        <div>
          <label htmlFor="q" className="block text-xs font-medium text-gray-600 mb-1">検索（マスター番号 / ハウス番号 / 配送番号）</label>
          <input
            id="q"
            name="q"
            defaultValue={keyword}
            placeholder="例: MAWB-240601-001 / HAWB-7788121 / C-1001"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button type="submit" className="w-full bg-gray-900 text-white rounded-md py-2 text-sm hover:bg-gray-700 transition-colors">
            検索
          </button>
        </div>
      </form>
    </div>
  );
}
