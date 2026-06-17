"use client";
import { useState } from "react";
import Link from "next/link";

type LaneNode = {
  name: string;
  subtext: string;
  value: number;
};

type BranchNode = {
  label: string;
  value: number;
  status?: string;
};

const mockData = {
  sidebar: {
    dashboard: [
      { label: "通関フロー", value: 1284, active: true },
      { label: "未申告在庫", value: 74 },
      { label: "未許可在庫", value: 49 },
      { label: "滅却予定", value: 12 },
    ],
    locations: [
      { label: "大阪/関西", value: 812 },
      { label: "東京/成田・新木場", value: 472 },
    ],
  },
  kpis: [
    { label: "本日対象件数", value: 1284, subtext: "データ受取済み" },
    { label: "3条件合流済み", value: 956, subtext: "PKGへ進行" },
    { label: "未申告在庫", value: 74, subtext: "予備審査側で停止" },
    { label: "未許可在庫", value: 49, subtext: "本申告後に滞留" },
    { label: "許可済み", value: 824, subtext: "搬出可能" },
    { label: "搬出済み", value: 768, subtext: "配送/次工程へ" },
  ],
  leftLane: [
    { name: "データ受取", subtext: "API / メール / 2.0", value: 1284 },
    { name: "HS/アイテムコード", subtext: "1課・通関士確認", value: 1162 },
    { name: "データ加工/クレンジング", subtext: "名前/住所/価格/重量/品名", value: 1084 },
    { name: "通関士チェック", subtext: "OK / 未申告在庫へ分岐", value: 1030 },
    { name: "NACCS申告準備", subtext: "予備審査側の合流条件", value: 956 },
  ],
  leftLaneBranch: [
    { label: "OK", value: 956 },
    { label: "未申告在庫", value: 74 },
  ],
  mergeNode: {
    value: 956,
    text: "3条件完了",
    subtext: "PKGへ",
  },
  rightLane: [
    { name: "ATA", subtext: "到着", value: 1196 },
    { name: "OLT", subtext: "横持ち/搬出手配", value: 1112 },
    { name: "OUT", subtext: "一次側搬出", value: 1034 },
    { name: "BIN", subtext: "エスポリア側搬入登録", value: 982 },
  ],
  pkgBranches: {
    top: [
      { label: "区分1", value: 824, status: "許可済み" },
      { label: "区分2", value: 83, status: "税関対応待ち" },
      { label: "区分3", value: 49, status: "書類確認追加" },
    ],
    bottom: [
      { label: "未許可在庫", value: 49, status: "継続対応" },
      { label: "滅却予定", value: 12, status: "終了系" },
      { label: "搬出", value: 768, status: "次工程へ" },
    ],
  },
  alerts: [
    { status: "未申告在庫", condition: "要確認", count: 74, color: "red" },
    { status: "税関対応待ち", condition: "区分2", count: 83, color: "amber" },
    { status: "書類確認追加", condition: "区分3", count: 49, color: "amber" },
    { status: "滅却予定", condition: "終了系", count: 12, color: "red" },
    { status: "搬出済み", condition: "完了", count: 768, color: "green" },
  ],
  routeDecisions: [
    {
      region: "大阪/関西：集約利用・通常",
      value: 488,
      steps: "1課：HS確認 → 2課：クレンジング → 2課：NACCS",
      active: true,
    },
    {
      region: "大阪/関西：集約非利用",
      value: 176,
      steps: "2課：データ入手 → クレンジング → NACCS",
    },
    {
      region: "大阪/関西：特定顧客・点数多い",
      value: 148,
      steps: "2課：先に加工 → 1課：HS確認 → 2課：再整備",
    },
    {
      region: "東京/成田・新木場",
      value: 472,
      steps: "加工者：クレンジング → 通関士：HS確認/申告判断",
    },
  ],
  progress: {
    percentage: 59.8,
    legend: ["許可/搬出", "審査中", "滞留"],
  },
};

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

function getConditionColor(color: string) {
  switch (color) {
    case "red":
      return "bg-[#fee2e2] text-[#dc2626] border border-[#fecaca]";
    case "amber":
      return "bg-[#fef3c7] text-[#d97706] border border-[#fde68a]";
    case "green":
      return "bg-[#d1fae5] text-[#059669] border border-[#a7f3d0]";
    default:
      return "bg-[#e2e8f0] text-[#475569] border border-[#cbd5e1]";
  }
}

function Sidebar() {
  return (
    <aside className="hidden lg:block fixed left-0 top-0 h-screen w-[264px] bg-[#111827] text-white border-r border-[#334155]/45">
      <div className="p-6 border-b border-[#334155]/45">
        <div className="flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-[10px] bg-gradient-to-br from-[#2563eb] to-[#059669] flex items-center justify-center text-white font-bold text-sm shadow-[0_4px_12px_rgba(37,99,235,0.34)]">
            通
          </div>
          <div>
            <h1 className="font-extrabold text-[18px] tracking-[-0.01em]">ESPORIA</h1>
            <p className="text-[11px] text-[#94a3b8]">Customs Control</p>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-[#334155]/45">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94a3b8] mb-4">Dashboard</h2>
        <div className="space-y-3">
          {mockData.sidebar.dashboard.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-3.5 py-3 rounded-[12px] cursor-pointer transition border ${
                item.active
                  ? "bg-[#1e293b] text-white border-[#334155]"
                  : "bg-transparent text-[#cbd5e1] border-transparent hover:bg-[#1f2937]"
              }`}
            >
              <span className="text-sm font-medium">{item.label}</span>
              <span className="bg-[#1f2937] text-white text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
                {fmt(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#94a3b8] mb-4">Locations</h2>
        <div className="space-y-2.5">
          {mockData.sidebar.locations.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[#cbd5e1] text-sm bg-[#0f172a] rounded-[12px] px-3 py-2.5 border border-[#334155]/40">
              <span className="text-[13px]">{item.label}</span>
              <span className="bg-[#1f2937] text-white text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
                {fmt(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <Link href="/" className="text-[#94a3b8] text-xs hover:text-[#e2e8f0] transition">
          ← 全体へ戻る
        </Link>
      </div>
    </aside>
  );
}

function Header() {
  const [filter, setFilter] = useState("全体");

  return (
    <header className="px-4 lg:px-6 pt-4 lg:pt-6">
      <div className="rounded-[18px] border border-[#d7dee9] bg-white/95 shadow-[0_10px_30px_rgba(15,23,42,0.04)] px-5 lg:px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-[22px] lg:text-[28px] leading-[1.2] font-extrabold tracking-[-0.025em] text-[#172033]">
              通関ダッシュボード｜予備審査 × 貨物ルート
            </h2>
            <p className="text-[13px] lg:text-[14px] text-[#64748b] mt-2">
              分岐別の滞留数、3条件合流、区分1/2/3を一画面で確認するサンプル画面
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {["全体", "大阪/関西", "東京/成田"].map((label) => (
              <button
                key={label}
                onClick={() => setFilter(label)}
                className={`px-4 py-2.5 rounded-[12px] text-sm font-semibold border transition ${
                  filter === label
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-white text-[#475569] border-[#d7dee9] hover:bg-[#f8fafc]"
                }`}
              >
                {label}
              </button>
            ))}
            <div className="px-4 py-2.5 rounded-[12px] text-sm font-medium border border-[#d7dee9] bg-white text-[#64748b]">
              対象日：2026/05/21
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function KPICard({ label, value, subtext }: { label: string; value: number; subtext: string }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#d7dee9] p-[14px] shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="text-[12px] font-medium text-[#64748b]">{label}</div>
      <div className="text-[28px] leading-none tracking-[-0.03em] font-extrabold text-[#172033] mt-2 tabular-nums">
        {fmt(value)}
      </div>
      <div className="text-[12px] text-[#64748b] mt-2">{subtext}</div>
    </div>
  );
}

function FlowNode({ name, subtext, value }: LaneNode) {
  return (
    <div className="bg-white rounded-[15px] border border-[#d7dee9] p-4 shadow-[0_6px_16px_rgba(15,23,42,0.045)]">
      <div className="flex items-start justify-between">
        <div className="pr-2">
          <div className="font-bold text-[#172033] text-[14px]">{name}</div>
          <div className="text-[11px] text-[#64748b] mt-1 leading-relaxed">{subtext}</div>
        </div>
        <div className="bg-[#dbeafe] text-[#2563eb] px-3 py-1 rounded-full font-bold text-sm ml-2 whitespace-nowrap tabular-nums">
          {fmt(value)}
        </div>
      </div>
    </div>
  );
}

function FlowLane({ title, subtitle, nodes, branch }: { title: string; subtitle: string; nodes: LaneNode[]; branch?: BranchNode[] }) {
  return (
    <div className="rounded-[18px] border border-[#d7dee9] bg-[#f8fafc] p-4 min-h-[640px]">
      <div className="mb-4 pb-3 border-b border-[#e2e8f0]">
        <h4 className="font-bold text-[#172033] text-sm">{title}</h4>
        <p className="text-[11px] text-[#64748b] mt-1">{subtitle}</p>
      </div>

      <div className="space-y-2">
        {nodes.map((node, idx) => (
          <div key={idx} className="relative pb-4 last:pb-0">
            <FlowNode {...node} />
            {idx < nodes.length - 1 && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full h-4 w-[2px] bg-[#cbd5e1] rounded-full" />
            )}
          </div>
        ))}
      </div>

      {branch && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {branch.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-[12px] border p-3 text-center ${
                idx === 0 ? "bg-[#d1fae5] border-[#a7f3d0]" : "bg-[#fee2e2] border-[#fecaca]"
              }`}
            >
              <div className="font-bold text-[#172033] text-[13px]">{item.label}</div>
              <div className="text-[24px] leading-none tracking-[-0.02em] font-extrabold text-[#172033] mt-2 tabular-nums">
                {fmt(item.value)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MergeNode({ value, text, subtext }: { value: number; text: string; subtext: string }) {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="bg-[#111827] text-white rounded-[18px] py-6 px-3 text-center shadow-[0_14px_30px_rgba(17,24,39,0.34)] w-[86px]">
        <div className="text-[34px] leading-none tracking-[-0.03em] font-extrabold tabular-nums">{fmt(value)}</div>
        <div className="text-[12px] font-bold mt-2 leading-tight">{text}</div>
        <div className="text-[11px] text-[#cbd5e1] mt-1">{subtext}</div>
      </div>
    </div>
  );
}

function BranchContainer({ branches, title, badge }: { branches: BranchNode[]; title: string; badge?: number }) {
  return (
    <div className="bg-white rounded-[18px] border-2 border-[#1e3a8a] p-4 shadow-[0_8px_20px_rgba(30,58,138,0.06)]">
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-[#172033] text-sm">{title}</div>
        {badge && (
          <div className="bg-[#dbeafe] text-[#2563eb] px-3 py-1 rounded-full font-bold text-sm tabular-nums">
            {fmt(badge)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {branches.map((item, idx) => (
          <div key={idx} className="bg-white rounded-[14px] p-3 border border-[#d7dee9] shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
            <div className="font-bold text-[#172033] text-sm">{item.label}</div>
            <div className="text-[24px] leading-none tracking-[-0.02em] font-extrabold text-[#172033] mt-2 tabular-nums">
              {fmt(item.value)}
            </div>
            <div className="text-[11px] text-[#64748b] mt-2">{item.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertTable() {
  return (
    <div className="bg-white rounded-[18px] border border-[#d7dee9] shadow-[0_8px_22px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="bg-white px-5 py-4 border-b border-[#d7dee9]">
        <h3 className="font-bold text-[#172033] text-sm">分岐アラート</h3>
        <p className="text-[12px] text-[#64748b] mt-1">滞留をクリックして詳細リストへ遷移する想定</p>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-[#f8fafc] border-b border-[#d7dee9]">
          <tr>
            <th className="px-5 py-3 text-left text-[12px] font-bold text-[#64748b]">分岐</th>
            <th className="px-5 py-3 text-center text-[12px] font-bold text-[#64748b]">状態</th>
            <th className="px-5 py-3 text-right text-[12px] font-bold text-[#64748b]">件数</th>
          </tr>
        </thead>
        <tbody>
          {mockData.alerts.map((alert, idx) => (
            <tr key={idx} className="border-b border-[#e2e8f0] hover:bg-[#f8fafc]">
              <td className="px-5 py-3.5 font-medium text-[#172033]">{alert.status}</td>
              <td className="px-5 py-3.5 text-center">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${getConditionColor(alert.color)}`}>
                  {alert.condition}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right font-extrabold text-[#172033] tabular-nums">{fmt(alert.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RouteDecisionCard({ region, value, steps, active }: { region: string; value: number; steps: string; active?: boolean }) {
  return (
    <div
      className={`rounded-[14px] border p-4 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition ${
        active ? "bg-[#eff6ff] border-[#60a5fa]" : "bg-white border-[#d7dee9]"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className={`text-sm font-bold ${active ? "text-[#1e3a8a]" : "text-[#172033]"}`}>{region}</div>
        </div>
        <div className="bg-[#dbeafe] text-[#2563eb] px-3 py-1 rounded-full font-bold text-sm ml-2 whitespace-nowrap tabular-nums">
          {fmt(value)}
        </div>
      </div>
      <div className="text-[12px] text-[#64748b] leading-relaxed">{steps}</div>
    </div>
  );
}

function ProgressCard() {
  return (
    <div className="bg-white rounded-[18px] border border-[#d7dee9] shadow-[0_8px_22px_rgba(15,23,42,0.04)] p-5">
      <h3 className="font-bold text-[#172033] text-sm">処理進捗</h3>
      <p className="text-[12px] text-[#64748b] mt-1">本日対象に対する搬出率</p>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-[#172033]">搬出済み</span>
          <span className="text-[22px] leading-none tracking-[-0.02em] font-extrabold text-[#172033] tabular-nums">
            {mockData.progress.percentage}%
          </span>
        </div>
        <div className="w-full bg-[#e2e8f0] rounded-full h-3 overflow-hidden">
          <div className="w-[59.8%] h-full rounded-full bg-gradient-to-r from-[#059669] to-[#2563eb]" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-[12px] text-[#64748b]">
        {mockData.progress.legend.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                idx === 0 ? "bg-[#059669]" : idx === 1 ? "bg-[#d97706]" : "bg-[#dc2626]"
              }`}
            />
            {item}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-[#e2e8f0] text-[11px] text-[#64748b] leading-relaxed">
        ※数値は画面サンプル用の仮データ。実装時はステータス別APIから件数を集計し、各ノード押下で対象リストに遷移。
      </div>
    </div>
  );
}

export default function CustomsDashboard() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef4ff_0%,#f4f7fb_22%,#f4f7fb_100%)] text-[#172033]">
      <Sidebar />

      <div className="lg:ml-[264px]">
        <Header />

        <div className="px-4 lg:px-6 pt-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-3 lg:gap-4">
            {mockData.kpis.map((kpi, idx) => (
              <KPICard key={idx} {...kpi} />
            ))}
          </div>
        </div>

        <div className="px-4 lg:px-6 pb-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 bg-white/95 rounded-[18px] border border-[#d7dee9] shadow-[0_12px_32px_rgba(15,23,42,0.05)] p-5">
              <div className="mb-5 pb-4 border-b border-[#d7dee9] flex items-end justify-between">
                <div>
                  <h3 className="text-[16px] font-bold text-[#172033]">フロー別ステータス数</h3>

                  <p className="text-[12px] text-[#64748b] mt-1">左：予備審査ルート / 右：貨物ルート。中央で3条件合流。</p>
                </div>
                <p className="text-[11px] text-[#64748b]">単位：件</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] gap-4 items-start">
                <FlowLane title="予備審査ルート" subtitle="データ処理" nodes={mockData.leftLane} branch={mockData.leftLaneBranch} />

                <div className="hidden lg:flex justify-center pt-24">
                  <MergeNode {...mockData.mergeNode} />
                </div>

                <div>
                  <FlowLane title="貨物ルート" subtitle="現物ステータス" nodes={mockData.rightLane} />
                  <div className="mt-3">
                    <BranchContainer
                      title="PKG → 本申告NACCS"
                      badge={956}
                      branches={[
                        ...mockData.pkgBranches.top,
                        ...mockData.pkgBranches.bottom,
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <AlertTable />

              <div className="bg-white rounded-[18px] border border-[#d7dee9] shadow-[0_8px_22px_rgba(15,23,42,0.04)] p-4">
                <h3 className="font-bold text-[#172033] text-sm mb-1">予備審査ルート判定</h3>
                <p className="text-[12px] text-[#64748b] mb-4">大阪と東京で順序が異なる点を明示</p>
                <div className="space-y-3">
                  {mockData.routeDecisions.map((route, idx) => (
                    <RouteDecisionCard key={idx} {...route} />
                  ))}
                </div>
              </div>

              <ProgressCard />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
