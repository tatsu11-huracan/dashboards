"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FilterKey = "all" | "kansai" | "tokyo";

type Metrics = {
  planned: number;
  staffPlan: number;
  pkg: number;
  pkgWait: number;
  olt: number;
  oltWait: number;
  out: number;
  bin: number;
  outBinWait: number;
  readyCheck: number;
  hpkReady: number;
  hpkWait: number;
  hpk: number;
  judged: number;
  permit: number;
  k2: number;
  k3: number;
  release: number;
  pickupWait: number;
  todayPickup: number;
  nextPickup: number;
  hold: number;
  unpermit: number;
  irregular: number;
  dailyCheck: number;
  kansaiStock: number;
  tokyoStock: number;
  closed: number;
  releaseBacklog: number;
  routes: {
    kansai: number;
    tokyo: number;
  };
};

const datasets: Record<FilterKey, Metrics> = {
  all: {
    planned: 3842,
    staffPlan: 3512,
    pkg: 3210,
    pkgWait: 632,
    olt: 3022,
    oltWait: 188,
    out: 2964,
    bin: 2886,
    outBinWait: 78,
    readyCheck: 2468,
    hpkReady: 2468,
    hpkWait: 418,
    hpk: 2318,
    judged: 2318,
    permit: 1764,
    k2: 238,
    k3: 64,
    release: 1764,
    pickupWait: 1764,
    todayPickup: 1102,
    nextPickup: 662,
    hold: 612,
    unpermit: 510,
    irregular: 102,
    dailyCheck: 9000,
    kansaiStock: 9000,
    tokyoStock: 4300,
    closed: 1426,
    releaseBacklog: 156,
    routes: {
      kansai: 2316,
      tokyo: 1526,
    },
  },
  kansai: {
    planned: 2316,
    staffPlan: 2180,
    pkg: 1988,
    pkgWait: 328,
    olt: 1872,
    oltWait: 116,
    out: 1840,
    bin: 1792,
    outBinWait: 48,
    readyCheck: 1518,
    hpkReady: 1518,
    hpkWait: 274,
    hpk: 1428,
    judged: 1428,
    permit: 1096,
    k2: 162,
    k3: 38,
    release: 1096,
    pickupWait: 1096,
    todayPickup: 704,
    nextPickup: 392,
    hold: 386,
    unpermit: 324,
    irregular: 62,
    dailyCheck: 9000,
    kansaiStock: 9000,
    tokyoStock: 4300,
    closed: 904,
    releaseBacklog: 92,
    routes: {
      kansai: 2316,
      tokyo: 0,
    },
  },
  tokyo: {
    planned: 1526,
    staffPlan: 1332,
    pkg: 1222,
    pkgWait: 304,
    olt: 1150,
    oltWait: 72,
    out: 1124,
    bin: 1094,
    outBinWait: 30,
    readyCheck: 950,
    hpkReady: 950,
    hpkWait: 144,
    hpk: 890,
    judged: 890,
    permit: 668,
    k2: 76,
    k3: 26,
    release: 668,
    pickupWait: 668,
    todayPickup: 398,
    nextPickup: 270,
    hold: 226,
    unpermit: 186,
    irregular: 40,
    dailyCheck: 4300,
    kansaiStock: 9000,
    tokyoStock: 4300,
    closed: 522,
    releaseBacklog: 64,
    routes: {
      kansai: 0,
      tokyo: 1526,
    },
  },
};

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

function progressWidthClass(filter: FilterKey): string {
  if (filter === "all") return "w-[80.8%]";
  if (filter === "kansai") return "w-[82.5%]";
  return "w-[78.1%]";
}

function pillClass(kind: "red" | "amber" | "green" | "blue" | "violet") {
  if (kind === "red") return "bg-[#fee2e2] text-[#b91c1c]";
  if (kind === "amber") return "bg-[#fef3c7] text-[#b45309]";
  if (kind === "green") return "bg-[#d1fae5] text-[#047857]";
  if (kind === "blue") return "bg-[#dbeafe] text-[#1d4ed8]";
  return "bg-[#ede9fe] text-[#6d28d9]";
}

function badgeClass(kind: "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "slate") {
  if (kind === "blue") return "bg-[#dbeafe] text-[#1d4ed8]";
  if (kind === "green") return "bg-[#d1fae5] text-[#047857]";
  if (kind === "amber") return "bg-[#fef3c7] text-[#b45309]";
  if (kind === "red") return "bg-[#fee2e2] text-[#b91c1c]";
  if (kind === "violet") return "bg-[#ede9fe] text-[#6d28d9]";
  if (kind === "cyan") return "bg-[#cffafe] text-[#0e7490]";
  return "bg-[#e2e8f0] text-[#334155]";
}

function MiniBox({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "ok" | "warn" | "ng" | "info";
}) {
  const toneClass =
    tone === "ok"
      ? "bg-[#d1fae5] border-[#a7f3d0]"
      : tone === "warn"
        ? "bg-[#fef3c7] border-[#fde68a]"
        : tone === "ng"
          ? "bg-[#fee2e2] border-[#fecaca]"
          : "bg-[#dbeafe] border-[#bfdbfe]";

  return (
    <div className={`rounded-[12px] p-2 border ${toneClass}`}>
      <div className="text-[12px] text-[#172033]">{title}</div>
      <div className="text-[20px] leading-none mt-1 font-extrabold tracking-[-0.02em] text-[#172033] tabular-nums">
        {fmt(value)}
      </div>
    </div>
  );
}

function FlowNode({
  name,
  meta,
  value,
  badgeTone,
  children,
  last,
}: {
  name: string;
  meta: string;
  value: number;
  badgeTone: "blue" | "green" | "amber" | "red" | "violet" | "cyan" | "slate";
  children?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className="relative mb-5 last:mb-0">
      <div className="bg-white border border-[#d7dee9] rounded-[15px] p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[14px] font-extrabold text-[#172033]">{name}</div>
            <div className="text-[11px] text-[#64748b] mt-1 leading-relaxed">{meta}</div>
          </div>
          <div className={`px-2.5 py-1 rounded-full text-[14px] font-extrabold tabular-nums ${badgeClass(badgeTone)}`}>
            {fmt(value)}
          </div>
        </div>
        {children}
      </div>
      {!last && <div className="absolute left-1/2 -translate-x-1/2 top-full h-[18px] w-[2px] bg-[#94a3b8]" />}
    </div>
  );
}

export default function BondedDashboardPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const data = datasets[filter];

  const progress = useMemo(() => {
    if (data.release === 0) return 0;
    return Math.round((data.closed / data.release) * 1000) / 10;
  }, [data.closed, data.release]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#f3f7fb_28%,#eef2f7_100%)] text-[#172033]">
      <div className="grid min-h-screen lg:grid-cols-[268px_1fr]">
        <aside className="hidden lg:block bg-[#0f172a] text-[#e5e7eb] px-[18px] py-[22px] border-r border-white/10">
          <div className="flex items-center gap-[10px] mb-6">
            <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-[#22c55e] to-[#06b6d4] grid place-items-center text-white font-bold">
              保
            </div>
            <div className="font-black text-[18px] leading-tight">
              ESPORIA
              <div className="text-[12px] font-semibold text-[#94a3b8]">Bonded Operation</div>
            </div>
          </div>

          <div className="text-[11px] tracking-[0.12em] uppercase text-[#94a3b8] mx-2 mb-2">Dashboard</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-[#1f2937] text-white text-[14px]">
              <span>保税フロー</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">3,842</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
              <span>横持ち待ち</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">188</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
              <span>未許可/保留</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">612</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
              <span>検査・イレギュラー</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">43</span>
            </div>
          </div>

          <div className="text-[11px] tracking-[0.12em] uppercase text-[#94a3b8] mx-2 mt-5 mb-2">拠点</div>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
              <span>関西/関空</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">2,316</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
              <span>東京/新木場</span>
              <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">1,526</span>
            </div>
          </div>

          <div className="mt-8 px-2">
            <Link href="/" className="text-[12px] text-[#94a3b8] hover:text-[#e2e8f0]">
              ← 全体へ戻る
            </Link>
          </div>
        </aside>

        <main className="p-[14px] lg:p-6 min-w-0">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
            <div>
              <h1 className="m-0 text-[28px] tracking-[-0.03em] font-extrabold leading-[1.2]">
                保税ダッシュボード｜PKG監視 → BIN/HPK → 搬出・集荷待ち
              </h1>
              <p className="mt-1.5 text-[14px] text-[#64748b] leading-relaxed">
                保税側の実作業開始点をBINとして、横持ち遅延・HPK待ち・未許可/保留・搬出済み翌日集荷待ちを一画面で確認するサンプル。
              </p>
            </div>
            <div className="flex gap-2 flex-wrap xl:justify-end">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-[12px] px-3 py-2 text-[13px] border shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
                  filter === "all"
                    ? "bg-[#111827] border-[#111827] text-white"
                    : "bg-white border-[#d7dee9] text-[#334155]"
                }`}
              >
                全体
              </button>
              <button
                onClick={() => setFilter("kansai")}
                className={`rounded-[12px] px-3 py-2 text-[13px] border shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
                  filter === "kansai"
                    ? "bg-[#111827] border-[#111827] text-white"
                    : "bg-white border-[#d7dee9] text-[#334155]"
                }`}
              >
                関西/関空
              </button>
              <button
                onClick={() => setFilter("tokyo")}
                className={`rounded-[12px] px-3 py-2 text-[13px] border shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
                  filter === "tokyo"
                    ? "bg-[#111827] border-[#111827] text-white"
                    : "bg-white border-[#d7dee9] text-[#334155]"
                }`}
              >
                東京/新木場
              </button>
              <span className="rounded-[12px] px-3 py-2 text-[13px] border border-[#d7dee9] bg-white text-[#334155] shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                対象日：2026/06/04
              </span>
            </div>
          </div>

          <section className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4" aria-label="主要KPI">
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">本日処理予定</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.planned)}</div>
              <div className="text-[12px] text-[#64748b]">マスター/便予定ベース</div>
            </div>
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">PKG確認済み</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.pkg)}</div>
              <div className="text-[12px] text-[#64748b]">上屋側で貨物確認</div>
            </div>
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">BIN済み</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.bin)}</div>
              <div className="text-[12px] text-[#64748b]">保税側に現物到着</div>
            </div>
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">HPK待ち</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.hpkWait)}</div>
              <div className="text-[12px] text-[#64748b]">申告/マニフェスト揃い待ち含む</div>
            </div>
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">未許可・保留</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.hold)}</div>
              <div className="text-[12px] text-[#64748b]">毎日チェック対象</div>
            </div>
            <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
              <div className="text-[12px] text-[#64748b]">搬出済み集荷待ち</div>
              <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(data.pickupWait)}</div>
              <div className="text-[12px] text-[#64748b]">集荷完了まで残す</div>
            </div>
          </section>

          <div className="grid xl:grid-cols-[minmax(820px,1.45fr)_minmax(340px,.55fr)] gap-4 items-start">
            <section className="bg-white/95 border border-[#d7dee9] rounded-[18px] shadow-[0_16px_40px_rgba(15,23,42,.08)] overflow-hidden">
              <div className="px-[18px] py-4 border-b border-[#d7dee9] flex items-center justify-between gap-3 bg-white/70">
                <div>
                  <div className="font-extrabold">保税作業フロー別ステータス数</div>
                  <div className="text-[12px] text-[#64748b] leading-relaxed mt-1">
                    左：前日/横持ち計画、中央：入庫・HPK、右：搬出・保留/イレギュラー。ノード押下で対象リストへ遷移する想定。
                  </div>
                </div>
                <div className="text-[12px] text-[#64748b]">単位：件</div>
              </div>

              <div className="p-4 overflow-auto">
                <div className="min-w-[1040px] grid grid-cols-3 gap-3">
                  <div className="bg-[#f8fafc] border border-[#d7dee9] rounded-[18px] p-[14px] min-h-[680px]">
                    <div className="flex items-center justify-between font-black mb-3">
                      <span>計画・横持ち</span>
                      <small className="text-[12px] font-semibold text-[#64748b]">PKG→OUT→BIN前</small>
                    </div>

                    <FlowNode
                      name="前日/当日予定取込"
                      meta="フライト・代理店・マスター・配送業者別件数"
                      value={data.planned}
                      badgeTone="blue"
                    />
                    <FlowNode
                      name="委託/派遣へ予定共有"
                      meta="関西15時目安 / 新木場17時前後"
                      value={data.staffPlan}
                      badgeTone="blue"
                    />
                    <FlowNode
                      name="APK/PKG監視"
                      meta="PKGは上屋側確認。現物はまだ保税側にない"
                      value={data.pkg}
                      badgeTone="violet"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="PKG済" value={data.pkg} tone="ok" />
                        <MiniBox title="PKG待ち" value={data.pkgWait} tone="warn" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="OLT/搬出予約・メール"
                      meta="関空: 予約/書類持参、成田: PDFメール・OUT待ち"
                      value={data.olt}
                      badgeTone="cyan"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="横持ち手配済" value={data.olt} tone="info" />
                        <MiniBox title="OLT未実施" value={data.oltWait} tone="ng" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="OUT確認・横持ち中"
                      meta="OUT後、車両登録/横持ち/バース到着を追跡"
                      value={data.out}
                      badgeTone="cyan"
                      last
                    />
                  </div>

                  <div className="bg-[#f8fafc] border border-[#d7dee9] rounded-[18px] p-[14px] min-h-[680px]">
                    <div className="flex items-center justify-between font-black mb-3">
                      <span>BIN・HPK</span>
                      <small className="text-[12px] font-semibold text-[#64748b]">現物前提の保税作業</small>
                    </div>

                    <FlowNode
                      name="BIN登録"
                      meta="貨物到着後、個数カウントしてNACCS登録"
                      value={data.bin}
                      badgeTone="green"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="BIN済" value={data.bin} tone="ok" />
                        <MiniBox title="OUT済BIN待ち" value={data.outBinWait} tone="warn" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="申告/マニフェスト揃い確認"
                      meta="マスター単位。揃わないものは通常処理から外す"
                      value={data.readyCheck}
                      badgeTone="amber"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="HPK可能" value={data.hpkReady} tone="ok" />
                        <MiniBox title="HPK待ち" value={data.hpkWait} tone="ng" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="HPK実行"
                      meta="BINなしHPKはエラー。通関側進捗との同期が重要"
                      value={data.hpk}
                      badgeTone="green"
                    />
                    <FlowNode
                      name="許可/審査区分判定"
                      meta="区分1は搬出へ、区分2/3・未申告は保留ゾーンへ"
                      value={data.judged}
                      badgeTone="slate"
                      last
                    >
                      <div className="mt-3 border-2 border-[#111827] rounded-[18px] bg-white p-3">
                        <div className="flex items-center justify-between font-black">
                          <span>HPK後分岐</span>
                          <span className={`px-2.5 py-1 rounded-full text-[13px] font-extrabold tabular-nums ${badgeClass("slate")}`}>
                            {fmt(data.judged)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2.5">
                          <div className="border border-[#d7dee9] rounded-[14px] p-2.5 bg-white">
                            <div className="text-[13px] font-extrabold">許可/区分1</div>
                            <div className="text-[24px] font-black tracking-[-0.03em] tabular-nums mt-1">{fmt(data.permit)}</div>
                            <div className="text-[12px] text-[#64748b]">搬出処理へ</div>
                          </div>
                          <div className="border border-[#d7dee9] rounded-[14px] p-2.5 bg-white">
                            <div className="text-[13px] font-extrabold">区分2/書類</div>
                            <div className="text-[24px] font-black tracking-[-0.03em] tabular-nums mt-1">{fmt(data.k2)}</div>
                            <div className="text-[12px] text-[#64748b]">再確認</div>
                          </div>
                          <div className="border border-[#d7dee9] rounded-[14px] p-2.5 bg-white">
                            <div className="text-[13px] font-extrabold">区分3/検査</div>
                            <div className="text-[24px] font-black tracking-[-0.03em] tabular-nums mt-1">{fmt(data.k3)}</div>
                            <div className="text-[12px] text-[#64748b]">検査置場へ</div>
                          </div>
                        </div>
                      </div>
                    </FlowNode>
                  </div>

                  <div className="bg-[#f8fafc] border border-[#d7dee9] rounded-[18px] p-[14px] min-h-[680px]">
                    <div className="flex items-center justify-between font-black mb-3">
                      <span>搬出・保留管理</span>
                      <small className="text-[12px] font-semibold text-[#64748b]">集荷完了まで表示</small>
                    </div>

                    <FlowNode
                      name="許可済み搬出処理"
                      meta="配送業者別仕分け。締め時刻超過は翌朝処理"
                      value={data.release}
                      badgeTone="green"
                    />
                    <FlowNode
                      name="搬出済み・集荷待ち"
                      meta="搬出で完了にせず、翌日集荷完了まで残す"
                      value={data.pickupWait}
                      badgeTone="amber"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="当日集荷待ち" value={data.todayPickup} tone="warn" />
                        <MiniBox title="翌日集荷待ち" value={data.nextPickup} tone="info" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="未許可/保留ゾーン"
                      meta="未許可・検査待ち・未申告・ラベルなし・配送切替待ち"
                      value={data.hold}
                      badgeTone="red"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="未許可" value={data.unpermit} tone="ng" />
                        <MiniBox title="確認待ち" value={data.irregular} tone="warn" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="毎日チェック・許可化拾い上げ"
                      meta="全体便/ハンディで許可化した貨物を再搬出へ戻す"
                      value={data.dailyCheck}
                      badgeTone="violet"
                    >
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <MiniBox title="関西目安" value={data.kansaiStock} tone="info" />
                        <MiniBox title="新木場目安" value={data.tokyoStock} tone="info" />
                      </div>
                    </FlowNode>
                    <FlowNode
                      name="集荷完了・日報更新"
                      meta="配送業者引渡し完了でクローズ"
                      value={data.closed}
                      badgeTone="green"
                      last
                    />
                  </div>
                </div>
              </div>
            </section>

            <aside className="grid gap-4">
              <section className="bg-white/95 border border-[#d7dee9] rounded-[18px] shadow-[0_16px_40px_rgba(15,23,42,.08)] overflow-hidden">
                <div className="px-[18px] py-4 border-b border-[#d7dee9]">
                  <div className="font-extrabold">保税アラート</div>
                  <div className="text-[12px] text-[#64748b] mt-1">SLA超過・締め時刻リスクを優先表示</div>
                </div>
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="text-left px-3 py-2 border-b border-[#d7dee9] bg-[#f8fafc] text-[11px] font-extrabold text-[#64748b]">対象</th>
                      <th className="text-left px-3 py-2 border-b border-[#d7dee9] bg-[#f8fafc] text-[11px] font-extrabold text-[#64748b]">状態</th>
                      <th className="text-right px-3 py-2 border-b border-[#d7dee9] bg-[#f8fafc] text-[11px] font-extrabold text-[#64748b]">件数</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">PKG後OLT未実施</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("red")}`}>監視漏れ</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.oltWait)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">OUT済BIN待ち</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("amber")}`}>到着/登録待ち</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.outBinWait)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">BIN済HPK不可</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("amber")}`}>申告未完了</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.hpkWait)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">許可済み搬出未処理</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("red")}`}>締め注意</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.releaseBacklog)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">翌日集荷待ち</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("blue")}`}>表示継続</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.nextPickup)}</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]">イレギュラー回答待ち</td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9]"><span className={`inline-flex rounded-full px-2 py-0.5 text-[12px] font-extrabold ${pillClass("violet")}`}>CS連携</span></td>
                      <td className="px-3 py-2.5 border-b border-[#d7dee9] text-right font-black tabular-nums">{fmt(data.irregular)}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="bg-white/95 border border-[#d7dee9] rounded-[18px] shadow-[0_16px_40px_rgba(15,23,42,.08)] overflow-hidden">
                <div className="px-[18px] py-4 border-b border-[#d7dee9]">
                  <div className="font-extrabold">拠点別運用差分</div>
                  <div className="text-[12px] text-[#64748b] mt-1">同じフロー内で関西/新木場の運用差を切替表示</div>
                </div>
                <div className="p-4 grid gap-2.5">
                  <div className="border border-[#0891b2] bg-[#ecfeff] rounded-[14px] p-3">
                    <div className="flex items-center justify-between font-extrabold text-[14px]">
                      <span>関西/関空</span>
                      <span className="tabular-nums">{fmt(data.routes.kansai)}</span>
                    </div>
                    <p className="text-[12px] text-[#64748b] leading-relaxed mt-1.5">
                      15時頃に当日処理件数を固める。PKG後、航空会社により搬出予約または書類持参。未許可在庫は作業後にまとめて確認する傾向。
                    </p>
                  </div>
                  <div className="border border-[#d7dee9] bg-white rounded-[14px] p-3">
                    <div className="flex items-center justify-between font-extrabold text-[14px]">
                      <span>東京/新木場</span>
                      <span className="tabular-nums">{fmt(data.routes.tokyo)}</span>
                    </div>
                    <p className="text-[12px] text-[#64748b] leading-relaxed mt-1.5">
                      前日到着分を翌日処理中心。OLT PDFをメール送信し、OUT確認後に車両登録。日中も許可リストから拾い上げる傾向。
                    </p>
                  </div>
                  <div className="border border-[#d7dee9] bg-white rounded-[14px] p-3">
                    <div className="flex items-center justify-between font-extrabold text-[14px]">
                      <span>配送締め注意</span>
                      <span className="tabular-nums">{fmt(data.releaseBacklog)}</span>
                    </div>
                    <p className="text-[12px] text-[#64748b] leading-relaxed mt-1.5">
                      エスポ便/郵便等は17:30以降許可で翌朝処理に回る運用あり。締め超過前にアラート。
                    </p>
                  </div>
                </div>
              </section>

              <section className="bg-white/95 border border-[#d7dee9] rounded-[18px] shadow-[0_16px_40px_rgba(15,23,42,.08)] overflow-hidden">
                <div className="px-[18px] py-4 border-b border-[#d7dee9]">
                  <div className="font-extrabold">本日搬出進捗</div>
                  <div className="text-[12px] text-[#64748b] mt-1">許可済み貨物に対する搬出/集荷完了率</div>
                </div>
                <div className="p-4 text-[12px] text-[#64748b] leading-relaxed">
                  <div className="flex items-center justify-between font-black text-[#172033] text-[14px]">
                    <span>集荷完了</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-[10px] bg-[#e2e8f0] rounded-full overflow-hidden mt-2 mb-3">
                    <div className={`h-full rounded-full bg-gradient-to-r from-[#22c55e] to-[#06b6d4] ${progressWidthClass(filter)}`} />
                  </div>
                  <div>
                    凡例：緑=集荷完了、黄=搬出済み集荷待ち、赤=未許可/保留。
                    <br />
                    ※ 数値は画面サンプル用の仮データ。実装時はNACCS/現場システム/保税Excelからステータス別に集計。
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
