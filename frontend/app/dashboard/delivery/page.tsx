"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ModeKey = "imp" | "dom";
type Tone = "blue" | "green" | "amber" | "red" | "violet";

type KpiItem = {
  title: string;
  value: number;
  subtext: string;
  tone: Tone;
};

type FlowItem = {
  label: string;
  value: number;
  note?: string;
  tone?: Tone;
};

type DropItem = {
  label: string;
  value: number;
  note?: string;
  tone: Tone;
};

type FlowColumn = {
  type: "stage" | "branch";
  title: string;
  value?: number;
  note?: string;
  flowTo?: number;
  items?: FlowItem[];
  drops?: DropItem[];
};

type DeliveryModeData = {
  sidebarCode: string;
  summaryDate: string;
  ruleList: string[];
  preProcessTitle: string;
  preProcessSteps: string[];
  preProcessSuffix: string;
  kpis: KpiItem[];
  columns: FlowColumn[];
};

const modeLabels: Record<ModeKey, string> = {
  imp: "輸入貨物配送（新木場）",
  dom: "国内集荷（TikTok・TEMU）",
};

const DELIVERY_DATA: Record<ModeKey, DeliveryModeData> = {
  imp: {
    sidebarCode: "IMP",
    summaryDate: "2026/06/12",
    ruleList: [
      "引渡しは⏰カットオフ（仮15時）で当日/翌日作業分を判定・翌日分は並行で事前準備",
      "マテハンは1次/2次/AMAZONバッグ仕分けまで一括→積込へ直行",
      "手仕分けは1次→2次を経由",
      "14時仕分け開始",
      "⏰18:30搬出カットオフ",
      "20〜21時積込完了",
      "翌朝5〜6時持ち出し",
      "⏰23:59までの配達完了=当日扱い",
      "35,000件/日キャパ",
      "業者カットライン: 佐川東京17時・城西20時・ヤマトA18時/B19時",
    ],
    preProcessTitle: "保税側（前工程・点線）",
    preProcessSteps: ["許可確認", "搬出スキャン", "業者別仕分け", "集荷・引渡し"],
    preProcessSuffix: "※搬出までは保税の仕事",
    kpis: [
      {
        title: "問題なし（フロー通り移動中・完了）",
        value: 11745,
        subtext: "本日処理対象 14,350 件のうち滞留なし",
        tone: "green",
      },
      {
        title: "KPI内の処理待ち",
        value: 510,
        subtext: "基準時間内・通常運用で解消見込み",
        tone: "amber",
      },
      {
        title: "KPIオーバー（要対応）",
        value: 140,
        subtext: "基準時間超過",
        tone: "red",
      },
      {
        title: "⏰ 翌日へ繰越（カットオフ超え）",
        value: 1955,
        subtext: "紫チップの合計",
        tone: "violet",
      },
    ],
    columns: [
      {
        type: "stage",
        title: "保税から引渡し（横持ち便 翌朝7時着）",
        value: 14350,
        note: "⏰引渡しカットオフ（仮15時・要確認）",
        flowTo: 14315,
        drops: [{ label: "ショート/オーバー差異", value: 35, note: "保税/通関へ戻し確認", tone: "amber" }],
      },
      {
        type: "branch",
        title: "◇ 作業日判定（カットオフ）",
        flowTo: 12465,
        items: [
          { label: "当日作業分", value: 12465, note: "カットオフ前の引渡し分 → 本日の仕分けへ", tone: "blue" },
          {
            label: "⏰ 翌日作業分（並行準備）",
            value: 1850,
            note: "カットオフ以降の引渡し・横持ち便分 / 翌朝の仕分けに向けて事前準備 / （場所確保・ラベル/データ事前確認）",
            tone: "violet",
          },
        ],
      },
      {
        type: "branch",
        title: "◇ 仕分け方式",
        flowTo: 4117,
        items: [
          { label: "手仕分け", value: 4102, note: "→ 1次仕分け・2次仕分けへ（1次/2次は手仕分けのみ）", tone: "blue" },
          {
            label: "マテハン（Chute自動振分）",
            value: 8250,
            note: "1次・2次・AMAZONバッグ仕分け（実施/非実施あり）まで一括処理 → 積込へ直行",
            tone: "green",
          },
          { label: "Chute異常（NO_DATA等）", value: 95, note: "↩80 ラベル補正→マテハン再投入／15は手仕分けへ", tone: "amber" },
          { label: "搬出許可なし", value: 18, note: "許可未確認のまま引渡された貨物 / 保税へ返却", tone: "red" },
        ],
      },
      {
        type: "stage",
        title: "一次仕分け（手仕分け）（14時開始・30〜60分）",
        value: 4117,
        note: "⏰18:30 搬出カットオフ",
        flowTo: 4117,
      },
      { type: "stage", title: "二次仕分け（手仕分け）（有償＋10円・1〜2時間）", value: 4117, flowTo: 4117 },
      {
        type: "branch",
        title: "◇ 積込（〜20-21時完了）",
        flowTo: 12342,
        items: [
          { label: "積込済み（当日便）", value: 12082, note: "業者・ドライバー別に積込完了", tone: "green" },
          { label: "↩ 再配達分（持ち戻りから再投入）", value: 260, note: "CS判断済みの再配達。当日便へ合流", tone: "blue" },
          {
            label: "⏰ 積み残し → 翌日便",
            value: 105,
            note: "35,000件/日キャパ・業者カットライン超え / 翌日便の先頭で積込",
            tone: "violet",
          },
        ],
      },
      {
        type: "branch",
        title: "◇ 持ち出し・配達状況（翌朝5〜6時持出）",
        flowTo: 12342,
        items: [
          { label: "配達中（順調）", value: 11262, note: "時間帯別進捗が計画内", tone: "green" },
          {
            label: "⚠ 遅延リスクあり",
            value: 1080,
            note: "時間帯進捗の遅れ・21時超え見込み等で判定 / 追跡強化・CS事前連絡の対象",
            tone: "amber",
          },
        ],
      },
      {
        type: "branch",
        title: "◇ 配達結果（⏰23:59 当日判定）",
        flowTo: 11732,
        items: [
          { label: "配達完了（定時）", value: 11122, note: "目標時間内に完了・置き配デフォルト", tone: "green" },
          {
            label: "配達完了（遅延）",
            value: 610,
            note: "23:59内だが目標時間超過 / 品質KPI・クレームリスク監視対象",
            tone: "amber",
          },
          { label: "持ち戻り", value: 610, note: "課題別に下のチップへ振分", tone: "red" },
        ],
        drops: [
          { label: "↩ 再配達（即時・CS判断済み）", value: 260, note: "緑線で積込の再配達レーンへ戻る", tone: "green" },
          { label: "再配達待ち（日程確定）", value: 90, note: "指定日到来→再配達", tone: "amber" },
          {
            label: "確認中 → 滞留在庫（住所不明PF確認 60／顧客確認 45）",
            value: 105,
            note: "回答→解消→再配達へ / 確認期限超え 30 → 廃棄",
            tone: "amber",
          },
          { label: "ラベル貼り替え", value: 35, note: "貼替完了→仕分けへ再投入", tone: "amber" },
          {
            label: "転送（住所変更等）",
            value: 70,
            note: "転送手続き→課金処理→時間により当日作業へ戻す / 遅い場合は翌日作業分へ",
            tone: "blue",
          },
          { label: "返品・請求（顧客/荷主指示で確定）", value: 50, tone: "red" },
        ],
      },
      {
        type: "branch",
        title: "◇ 出口（最終終了条件）",
        items: [
          { label: "配達完了", value: 11122, note: "正常出口。KPI: 完了率・24h達成率", tone: "green" },
          { label: "配達完了（遅延）", value: 610, note: "完了扱いだが遅延フラグ付き", tone: "amber" },
          { label: "返品・請求", value: 50, note: "返品30・請求20", tone: "red" },
          { label: "廃棄（確認期限超え）", value: 30, note: "滞留在庫のうち期限超え分", tone: "red" },
        ],
      },
    ],
  },
  dom: {
    sidebarCode: "DOM",
    summaryDate: "2026/06/12",
    ruleList: [
      "⏰12時カット（データ範囲: 前日12:01〜当日11:59）",
      "集荷は営業時間内が基本",
      "出発便: 17時（通常）・18時（最終）",
      "99拠点（東京23区中心）",
      "単価500円→段階的に30円目標",
    ],
    preProcessTitle: "プラットフォーム（前工程・点線）",
    preProcessSteps: ["TikTok/TEMU 集荷依頼API", "⏰12時データ確定", "失敗理由コード送信（API）", "集荷完了通知"],
    preProcessSuffix: "※PF連携はシステム部",
    kpis: [
      {
        title: "問題なし（フロー通り移動中・完了）",
        value: 1299,
        subtext: "本日処理対象 1,850 件のうち滞留なし",
        tone: "green",
      },
      {
        title: "KPI内の処理待ち",
        value: 132,
        subtext: "基準時間内・通常運用で解消見込み",
        tone: "amber",
      },
      { title: "KPIオーバー（要対応）", value: 39, subtext: "基準時間超過", tone: "red" },
      { title: "⏰ 翌日へ繰越（カットオフ超え）", value: 380, subtext: "紫チップの合計", tone: "violet" },
    ],
    columns: [
      {
        type: "stage",
        title: "PF集荷依頼受領（TikTok/TEMU API）",
        value: 1850,
        note: "⏰12時カット",
        flowTo: 1530,
        drops: [{ label: "⏰ 12時以降の依頼→翌日集荷", value: 320, tone: "violet" }],
      },
      { type: "stage", title: "当日集荷対象（前日12:01〜当日11:59）", value: 1530, flowTo: 1530 },
      {
        type: "stage",
        title: "電話/連絡確認（営業時間・準備状況）",
        value: 1530,
        flowTo: 1485,
        drops: [{ label: "連絡不能", value: 45, note: "超過10 / ↩30 再連絡で確認→ルートへ", tone: "amber" }],
      },
      { type: "stage", title: "ルート計画・アプリ配信（午後出発）", value: 1485, flowTo: 1485 },
      {
        type: "branch",
        title: "◇ 集荷結果",
        flowTo: 1371,
        items: [
          { label: "集荷成功", value: 1371, note: "成功率92.3%", tone: "green" },
          {
            label: "集荷失敗（理由登録→PF送信）",
            value: 114,
            note: "ラベル未貼付/未準備/不在/閉店/住所不明/連絡不能/対象外 / 超過12",
            tone: "red",
          },
        ],
        drops: [
          { label: "⏰ 再集荷判断→翌日ルートへ", value: 86, note: "荷主指示・理由解消で翌日再集荷", tone: "violet" },
          { label: "対象外・中止 → 集荷終了", value: 28, tone: "red" },
        ],
      },
      {
        type: "stage",
        title: "拠点戻り・仕分け投入",
        value: 1371,
        note: "⏰17時通常便・18時最終便",
        flowTo: 1311,
        drops: [{ label: "⏰ 17/18時便に未接続→翌日", value: 60, tone: "violet" }],
      },
      {
        type: "branch",
        title: "◇ 出口（最終終了条件）",
        items: [
          { label: "配送投入（国内配送へ）", value: 1311, note: "翌日配送ルートへ接続（正常出口）", tone: "green" },
          { label: "集荷終了（PF失敗送信済み）", value: 28, note: "対象外/中止確定。荷主対応へ", tone: "red" },
        ],
      },
    ],
  },
};

function fmt(n: number): string {
  return n.toLocaleString("ja-JP");
}

function toneClass(tone: Tone): string {
  if (tone === "green") return "bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]";
  if (tone === "amber") return "bg-[#fef3c7] text-[#7c4a03] border-[#fde68a]";
  if (tone === "red") return "bg-[#fee2e2] text-[#7f1d1d] border-[#fecaca]";
  if (tone === "violet") return "bg-[#ede9fe] text-[#4c1d95] border-[#ddd6fe]";
  return "bg-[#dbeafe] text-[#1e3a8a] border-[#bfdbfe]";
}

function Sidebar({ mode, data, onModeChange }: { mode: ModeKey; data: DeliveryModeData; onModeChange: (mode: ModeKey) => void }) {
  return (
    <aside className="hidden lg:block bg-[#0f172a] text-[#e5e7eb] px-[18px] py-[22px] border-r border-white/10">
      <div className="flex items-center gap-[10px] mb-6">
        <div className="w-9 h-9 rounded-[11px] bg-gradient-to-br from-[#22c55e] to-[#06b6d4] grid place-items-center text-white font-bold">配</div>
        <div className="font-black text-[18px] leading-tight">
          ESPORIA
          <div className="text-[12px] font-semibold text-[#94a3b8]">Delivery Operation</div>
        </div>
      </div>

      <div className="text-[11px] tracking-[0.12em] uppercase text-[#94a3b8] mx-2 mb-2">Dashboard</div>
      <div className="space-y-1">
        <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-[#1f2937] text-white text-[14px]">
          <span>配送フロー</span>
          <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">{fmt(data.kpis[0].value)}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
          <span>KPI内待ち</span>
          <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">{fmt(data.kpis[1].value)}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
          <span>KPIオーバー</span>
          <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">{fmt(data.kpis[2].value)}</span>
        </div>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[#cbd5e1] text-[14px]">
          <span>翌日繰越</span>
          <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[12px] tabular-nums">{fmt(data.kpis[3].value)}</span>
        </div>
      </div>

      <div className="text-[11px] tracking-[0.12em] uppercase text-[#94a3b8] mx-2 mt-5 mb-2">モード</div>
      <div className="space-y-1">
        {(Object.keys(modeLabels) as ModeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onModeChange(key)}
            className={`w-full text-left flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[14px] border ${
              mode === key ? "bg-[#1f2937] border-[#334155] text-white" : "bg-transparent border-transparent text-[#cbd5e1] hover:bg-[#1f2937]"
            }`}
          >
            <span>{modeLabels[key]}</span>
            <span className="bg-[#334155] rounded-full px-2 py-0.5 text-[11px]">{DELIVERY_DATA[key].sidebarCode}</span>
          </button>
        ))}
      </div>

      <div className="mt-8 px-2">
        <Link href="/" className="text-[12px] text-[#94a3b8] hover:text-[#e2e8f0]">← 全体へ戻る</Link>
      </div>
    </aside>
  );
}

function Header({ mode, data, onModeChange }: { mode: ModeKey; data: DeliveryModeData; onModeChange: (mode: ModeKey) => void }) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-4">
      <div>
        <h1 className="m-0 text-[28px] tracking-[-0.03em] font-extrabold leading-[1.2]">配送ダッシュボード｜横型フロー監視</h1>
        <p className="mt-1.5 text-[14px] text-[#64748b] leading-relaxed">
          数字が左から右へ流れる配送パイプラインを、通関・保税と同じダッシュボードUIで可視化する。滞留、翌日繰越、戻り、出口条件まで一画面で確認できる構成にする。
        </p>
      </div>

      <div className="flex gap-2 flex-wrap xl:justify-end">
        {(Object.keys(modeLabels) as ModeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => onModeChange(key)}
            className={`rounded-[12px] px-3 py-2 text-[13px] border shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
              mode === key ? "bg-[#111827] border-[#111827] text-white" : "bg-white border-[#d7dee9] text-[#334155]"
            }`}
          >
            {modeLabels[key]}
          </button>
        ))}
        <span className="rounded-[12px] px-3 py-2 text-[13px] border border-[#d7dee9] bg-white text-[#334155] shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          対象日：{data.summaryDate}
        </span>
      </div>
    </div>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  return (
    <div className="bg-white border border-[#d7dee9] rounded-[16px] p-[14px] shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] text-[#64748b]">{item.title}</div>
        <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${toneClass(item.tone)}`}>{item.tone}</span>
      </div>
      <div className="text-[28px] font-black tracking-[-0.04em] tabular-nums">{fmt(item.value)}</div>
      <div className="text-[12px] text-[#64748b]">{item.subtext}</div>
    </div>
  );
}

function ProcessLane({ data }: { data: DeliveryModeData }) {
  return (
    <>
      <div className="border-2 border-dashed border-[#94a3b8] rounded-[14px] bg-[#f1f5f9] p-3">
        <div className="flex items-center gap-2 flex-wrap text-[12px]">
          <span className="rounded-[8px] bg-[#64748b] text-white px-2 py-1 font-bold">{data.preProcessTitle}</span>
          {data.preProcessSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-2 text-[#475569] font-semibold">
              <span>{step}</span>
              {index < data.preProcessSteps.length - 1 && <span className="text-[#94a3b8]">→</span>}
            </div>
          ))}
          <span className="text-[#1f4e79] font-bold">{data.preProcessSuffix}</span>
        </div>
      </div>
      <div className="flex justify-center text-[11px] text-[#64748b] font-bold">▼ 前工程からの引渡し・ステータス連携</div>
    </>
  );
}

function StageCard({ title, value, note }: { title: string; value?: number; note?: string }) {
  return (
    <div className="w-[230px] bg-white border border-[#d7dee9] rounded-[14px] p-3 shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="text-[13px] font-extrabold text-[#172033] leading-snug">{title}</div>
      {value !== undefined && <div className="text-[26px] leading-none mt-2 font-black tracking-[-0.03em] tabular-nums">{fmt(value)}</div>}
      {note && <div className="text-[11px] text-[#6d28d9] mt-1 leading-relaxed">{note}</div>}
    </div>
  );
}

function BranchCard({ title, items }: { title: string; items: FlowItem[] }) {
  return (
    <div className="w-[300px] bg-[#f8fafc] border border-[#d7dee9] rounded-[14px] p-3">
      <div className="text-[13px] font-extrabold text-[#172033] mb-2">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-[12px] border p-2 ${toneClass(item.tone ?? "blue")}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-[12px] font-bold leading-snug">{item.label}</div>
              <div className="text-[20px] leading-none font-black tabular-nums">{fmt(item.value)}</div>
            </div>
            {item.note && <div className="text-[11px] mt-1 leading-relaxed">{item.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DropChip({ item }: { item: DropItem }) {
  return (
    <div className={`rounded-[10px] border px-2.5 py-2 ${toneClass(item.tone)}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold leading-snug">{item.label}</div>
        <div className="text-[16px] leading-none font-black tabular-nums">{fmt(item.value)}</div>
      </div>
      {item.note && <div className="text-[10px] mt-1 leading-relaxed">{item.note}</div>}
    </div>
  );
}

function DeliveryPipelineCard({ data }: { data: DeliveryModeData }) {
  return (
    <section className="bg-white/95 border border-[#d7dee9] rounded-[18px] shadow-[0_16px_40px_rgba(15,23,42,.08)] overflow-hidden">
      <div className="px-[18px] py-4 border-b border-[#d7dee9] flex items-center justify-between gap-3 bg-white/70">
        <div>
          <div className="font-extrabold">配送フロー別ステータス数</div>
          <div className="text-[12px] text-[#64748b] leading-relaxed mt-1">
            左から右へ配送工程が進行し、途中の分岐・滞留・翌日繰越・戻り・出口条件を確認できる構成にする。
          </div>
        </div>
        <div className="text-[12px] text-[#64748b]">単位：件</div>
      </div>

      <div className="p-4 space-y-3">
        <ProcessLane data={data} />

        <div className="overflow-x-auto pb-2">
          <div className="min-w-[1920px] flex items-start gap-3">
            {data.columns.map((column, index) => (
              <div key={`${column.title}-${index}`} className="flex items-start gap-3">
                <div className="space-y-2">
                  {column.type === "stage" ? (
                    <StageCard title={column.title} value={column.value} note={column.note} />
                  ) : (
                    <BranchCard title={column.title} items={column.items ?? []} />
                  )}
                  {column.drops && (
                    <div className="space-y-1 border border-dashed border-[#cbd5e1] rounded-[12px] p-2 bg-[#f8fafc]">
                      {column.drops.map((drop) => (
                        <DropChip key={`${drop.label}-${drop.value}`} item={drop} />
                      ))}
                    </div>
                  )}
                </div>

                {index < data.columns.length - 1 && (
                  <div className="pt-6 min-w-[74px] text-center">
                    <div className="text-[11px] font-bold text-[#1d4ed8] tabular-nums">{column.flowTo !== undefined ? fmt(column.flowTo) : "次へ"}</div>
                    <div className="mt-1 h-[3px] rounded-full bg-[#93c5fd] relative">
                      <span className="absolute right-[-4px] top-[-4px] text-[#1d4ed8] text-[12px]">▶</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RuleSummaryCard({ data }: { data: DeliveryModeData }) {
  return (
    <div className="bg-white border border-[#d7dee9] rounded-[16px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[15px] font-extrabold text-[#172033]">配送ルール概要</div>
      <div className="text-[12px] text-[#64748b] mt-1">現在のモードに応じたカットオフ・作業条件・運用ルールを表示</div>
      <div className="mt-3 space-y-2">
        {data.ruleList.map((rule) => (
          <div key={rule} className="text-[12px] leading-relaxed text-[#334155] rounded-[10px] border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-2">
            {rule}
          </div>
        ))}
      </div>
    </div>
  );
}

function LinkedProcessCard({ data }: { data: DeliveryModeData }) {
  return (
    <div className="bg-white border border-[#d7dee9] rounded-[16px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[15px] font-extrabold text-[#172033]">前工程・連携ポイント</div>
      <div className="text-[12px] text-[#64748b] mt-1">保税またはプラットフォームとの接続点を表示</div>

      <div className="mt-3 rounded-[12px] border-2 border-dashed border-[#cbd5e1] bg-[#f8fafc] p-3">
        <div className="inline-flex px-2 py-1 rounded-[8px] bg-[#64748b] text-white text-[11px] font-bold">{data.preProcessTitle}</div>
        <div className="mt-2 space-y-1.5">
          {data.preProcessSteps.map((step) => (
            <div key={step} className="rounded-[9px] border border-[#d7dee9] bg-white px-2.5 py-2 text-[12px] font-semibold text-[#334155]">
              {step}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] font-bold text-[#1f4e79]">{data.preProcessSuffix}</div>
      </div>

      <div className="mt-3 text-[12px] text-[#64748b] font-semibold">▼ 前工程からの引渡し・ステータス連携</div>
    </div>
  );
}

function LegendNoteCard() {
  const legendRows: Array<{ label: string; tone: Tone }> = [
    { label: "通常工程（通過件数）", tone: "blue" },
    { label: "滞留（KPI内）", tone: "amber" },
    { label: "KPIオーバー", tone: "red" },
    { label: "翌日へ繰越", tone: "violet" },
    { label: "戻り/再投入", tone: "green" },
    { label: "保税へ返却", tone: "red" },
    { label: "分岐", tone: "blue" },
  ];

  return (
    <div className="bg-white border border-[#d7dee9] rounded-[16px] p-4 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="text-[15px] font-extrabold text-[#172033]">凡例・注記</div>
      <div className="text-[12px] text-[#64748b] mt-1">色や記号の意味、および運用上の注意点</div>

      <div className="mt-3 space-y-2">
        {legendRows.map((row) => (
          <div key={row.label} className="flex items-center gap-2 text-[12px] text-[#334155]">
            <span className={`inline-block w-4 h-4 rounded border ${toneClass(row.tone)}`} />
            <span>{row.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[#e2e8f0] text-[11px] text-[#64748b] leading-relaxed space-y-1">
        <div>出典: 業務一覧（4.1〜4.5）・議事録（2026-04-10 配送、04-16 配送部、05-01 国内配送PJ、05-08 国内集荷、05-14 経営会議）</div>
        <div>数値は全てダミー</div>
        <div>失敗理由コードのPF対応表・KPI基準は要確認</div>
      </div>
    </div>
  );
}

export default function DeliveryDashboardPage() {
  const [mode, setMode] = useState<ModeKey>("imp");
  const data = useMemo(() => DELIVERY_DATA[mode], [mode]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#eef7ff_0%,#f3f7fb_28%,#eef2f7_100%)] text-[#172033]">
      <div className="grid min-h-screen lg:grid-cols-[268px_1fr]">
        <Sidebar mode={mode} data={data} onModeChange={setMode} />

        <main className="p-[14px] lg:p-6 min-w-0">
          <Header mode={mode} data={data} onModeChange={setMode} />

          <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4" aria-label="主要KPI">
            {data.kpis.map((kpi) => (
              <KpiCard key={kpi.title} item={kpi} />
            ))}
          </section>

          <div className="grid xl:grid-cols-[minmax(860px,1.45fr)_minmax(340px,.55fr)] gap-4 items-start">
            <DeliveryPipelineCard data={data} />

            <aside className="space-y-3">
              <RuleSummaryCard data={data} />
              <LinkedProcessCard data={data} />
              <LegendNoteCard />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
