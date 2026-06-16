# ESP3.0 ダッシュボード用 DB 設計 (汎用版 addendum)

> **参照元**: `esp3-db-design.md` (PG版) / `esp3-db-design-mysql.md` (MySQL版) の addendum  
> DDL 例は MySQL 記法。PG 版は型変換表に従う。  
> 現場合意済みモック: `2026-06-11_通関ダッシュボード_フロー滞留生産性_モック.html`

---

## 目次

1. [設計方針](#0-設計方針)
2. [マスタ系 (10表)](#1-マスタ系-10表)
3. [KPI 目標 (2表)](#2-kpi-目標-2表)
4. [実績値・滞留 (6表)](#3-実績値滞留-6表)
5. [アラートエンジン (3表)](#4-アラートエンジン-3表)
6. [通知配信 (3表)](#5-通知配信-3表)
7. [アラート発火・通知の運用シーケンス](#6-アラート発火通知の運用シーケンス)
8. [集計バッチ運用](#7-集計バッチ運用)
9. [ダッシュボード Widget タイプ](#8-ダッシュボード-widget-タイプ)
10. [付録A. KPI カタログ初期データ](#付録a-kpi-カタログ初期データ)
11. [付録B. business-flow.md §7.2 ギャップ候補 14件 対応マッピング](#付録b-ギャップ候補-14件-対応マッピング)
12. [付録C. モック表示要素の検証チェックリスト](#付録c-モック表示要素の検証チェックリスト)
13. [付録D. PG/MySQL 差分メモ](#付録d-pgmysql-差分メモ)
14. [付録E. 実装時の注意](#付録e-実装時の注意)
15. [付録F. モック表示要素 → テーブル 詳細マッピング票](#付録f-モック表示要素--テーブル-詳細マッピング票)
16. [次のアクション](#12-次のアクション)

---

## 0. 設計方針

### 0.1 機能スコープ

| カテゴリ | 機能 |
|---|---|
| 可視化 | 通関/保税/配送/集荷の業務フロー上の通過件数・分岐結果・滞留量 |
| KPI 管理 | KPI の定義・目標設定・実績集計・目標差分の表示 |
| 滞留管理 | 工程間滞留量を時間バケット (24h/48h/1w/2w/4w-/4w+) で可視化 |
| アラート | KPI 閾値違反の自動検知 + Slack/LINE/Email 配信 + 確認・解決ワークフロー |
| 体制管理 | 拠点・ロール別の計画人数 vs 実績人数 |
| 業務ルール | 拠点別カットライン・運用ルールを DB 管理 |

### 0.2 既存 ESP3 テーブルとの責任分界

| ESP3 既存テーブル | 本書での利用 |
|---|---|
| `shipment_event` | **ソースデータ**。日次バッチで集計して `kpi_actual` へ |
| `shipment` / `manifest` / `customs_declaration` | 件数・状態のソース |
| `issue` | 申告不備在庫のソース。新規 2 列追加 (§3.5) |
| `manifest_kpi_daily` / `delivery_kpi_daily` / `call_kpi_daily` | 既存の領域別 KPI。本書の汎用基盤と**並存**、将来統合判断 |
| `admin_dashboard_config` / `admin_saved_filter` | UI 設定として**そのまま再利用**、widget_type のみ拡張 |
| `domain_event` | アラート発火時の outbox 投入先 |
| `account` (esp3_auth) | acknowledgement / 通知宛先 |

### 0.3 命名規約

- KPI 関連: `kpi_` プレフィックス
- アラート関連: `alert_` プレフィックス
- マスタ: `*_definition` (定義) / `business_*` (拠点・ルート) / `staffing_*` (体制)
- スナップショット: `*_snapshot` (日次断面)
- ESP3 横断規約 (`tenant_id` / 監査列) を踏襲

### 0.4 全体アーキテクチャ

```
[ソース層]                  [集計層]                       [可視化層]
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ shipment_event   │  │ kpi_aggregation_job   │  │ admin_dashboard_config│
│ shipment         │─┐│ (日次バッチ群)         │  │ + widget_type         │
│ manifest         │ ││ - dwell_aging         │  └──────┬───────────────┘
│ issue            │ ├─►│ - issue_aging        │         │
│ external_track   │ ││ - productivity        │         │
│ customs_decl     │─┘│ - cost_forecast       │         │
└──────────────────┘  │ - backflow_count      │         │
                      └──────────┬───────────┘         │
                                 ▼                      │
                    ┌────────────────────────────────┐  │
                    │ kpi_actual                     │◄─┘ R
                    │ stage_dwell_snapshot           │
                    │ issue_aging_snapshot           │
                    │ staffing_actual_daily          │
                    └─────────────┬──────────────────┘
                                  │
                                  ▼
                    kpi_evaluation_engine
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │ alert_rule + kpi_target      │
                    │ ↓                            │
                    │ alert_instance               │
                    │ ↓                            │
                    │ alert_routing_rule           │
                    │ ↓                            │
                    │ alert_notification_dispatch  │──► Slack/LINE/Email/IN_APP
                    └─────────────────────────────┘
```

---

## 1. マスタ系 (10表)

### 1.1 `kpi_definition` — KPI 定義

KPI そのものの定義。「何を、どう測るか」。`kpi_target` (目標値) と `kpi_actual` (実績値) は本テーブルを参照する。

```sql
CREATE TABLE kpi_definition (
  code                   VARCHAR(64)  NOT NULL PRIMARY KEY,  -- 'CUSTOMS_PERMIT_RATE' 等
  tenant_id              VARCHAR(16),                        -- NULL=全社共通定義
  name_ja                VARCHAR(255) NOT NULL,
  name_en                VARCHAR(255),
  short_label            VARCHAR(64),                        -- ダッシュボード短縮表示用
  category_code          VARCHAR(32)  NOT NULL,              -- → kpi_category
  process_step_code      VARCHAR(16),                        -- → process_step (C-09 等、NULL=横断)
  metric_type            VARCHAR(16)  NOT NULL,              -- COUNT / RATE / DURATION_HOURS / DURATION_MS / COST_JPY / PERCENT
  unit                   VARCHAR(16),                        -- '件' / '%' / 'hour' / '円' / 'KGM'
  formula_description    TEXT,                               -- 人間可読の計算式
  source_query_template  TEXT,                               -- SQL テンプレ。`:tenant_id` `:bucket_date` 等の変数を含む
  aggregation_window     VARCHAR(16)  NOT NULL DEFAULT 'DAILY', -- DAILY / HOURLY / MONTHLY / SNAPSHOT / REALTIME / NEAR_REALTIME
  default_dimensions     JSON,                               -- ['tenant_id','agency_id','business_location_code']
  is_higher_better       TINYINT(1)   NOT NULL DEFAULT 1,   -- 完了率=true、遅延=false (アラート判定方向)
  owner_dept_code        VARCHAR(32),
  is_active              TINYINT(1)   NOT NULL DEFAULT 1,
  display_order          INT,
  description            TEXT,
  created_at             TIMESTAMP(6),
  updated_at             TIMESTAMP(6),
  created_by             VARCHAR(64),
  updated_by             VARCHAR(64),
  KEY idx_kpi_def_category (category_code, display_order),
  KEY idx_kpi_def_step (process_step_code)
);
```

### 1.2 `kpi_category` — KPI カテゴリ

```sql
CREATE TABLE kpi_category (
  code         VARCHAR(32) NOT NULL PRIMARY KEY, -- CUSTOMS / BONDED / DELIVERY / PICKUP / E2E
  name_ja      VARCHAR(64) NOT NULL,
  display_order INT        NOT NULL,
  color_token  VARCHAR(16),                      -- UI色 'blue'/'green'/'amber'/'red'
  description  VARCHAR(255)
);
```

**初期データ**

| code | name_ja | display_order |
|---|---|---|
| CUSTOMS | 通関 | 1 |
| BONDED | 保税 | 2 |
| DELIVERY | 配送 | 3 |
| PICKUP | 国内集荷 | 4 |
| E2E | 横断/E2E | 5 |

### 1.3 `process_step` — 業務番号マスタ

`base.md` の C-01〜C-10 / B-01〜B-15 / D-01〜D-09 / P-01〜P-09 を DB 化。

```sql
CREATE TABLE process_step (
  code                      VARCHAR(16)  NOT NULL PRIMARY KEY, -- 'C-01' / 'B-10' / 'D-08' / 'P-01' 等
  category_code             VARCHAR(32)  NOT NULL,             -- → kpi_category
  name_ja                   VARCHAR(255) NOT NULL,
  short_name                VARCHAR(64),                        -- フロー図用短縮名 'BIN登録' 等
  step_order                INT          NOT NULL,              -- カテゴリ内のソート順
  normal_duration_minutes   INT,                               -- 標準処理時間 (滞留判定基準)
  next_step_codes           JSON,                              -- 通常時の遷移先 ['C-02']、分岐なら複数
  is_terminal               TINYINT(1)   DEFAULT 0,            -- 終了系か (滅却/撤回/積戻し)
  KEY idx_step_category (category_code, step_order)
);
```

### 1.4 `business_location` — 拠点マスタ

`base.md §3.5` (関西/成田/羽田) と `business-flow.md §3.2` の拠点。モックの拠点切替トグルで使用。

```sql
CREATE TABLE business_location (
  code                   VARCHAR(16) NOT NULL PRIMARY KEY, -- KIX / NRT / HND / SHINKIBA / HKT
  name_ja                VARCHAR(64) NOT NULL,             -- '関西/関空' '成田' '羽田' '新木場' '博多'
  region                 VARCHAR(16),                      -- KANSAI / KANTO / KYUSHU
  timezone               VARCHAR(32) DEFAULT 'Asia/Tokyo',
  is_active              TINYINT(1)  NOT NULL DEFAULT 1,
  display_order          INT,
  parent_location_code   VARCHAR(16),                      -- 関東圏のように親拠点でグルーピング可
  KEY idx_loc_region (region)
);
```

### 1.5 `business_location_rule` — 拠点別運用ルール

モックの**拠点別ルールバー**を構造化保持。

```sql
CREATE TABLE business_location_rule (
  id                         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id                  VARCHAR(16)  NOT NULL,
  business_location_code     VARCHAR(16)  NOT NULL,
  rule_type                  VARCHAR(32)  NOT NULL, -- CUTOFF_TIME / DAILY_POLICY / PRIORITY_POLICY / SPECIAL_NOTE
  rule_key                   VARCHAR(64)  NOT NULL, -- 'TSUKAI_CUTOFF' / 'PERMIT_RECEIVE_CUTOFF_PM' 等
  rule_value                 VARCHAR(255),          -- '15:00' / '17:30'
  rule_description           VARCHAR(500),          -- 人間可読 (ダッシュボード表示用)
  effective_from             DATE         NOT NULL,
  effective_to               DATE,
  is_displayed_on_dashboard  TINYINT(1)   NOT NULL DEFAULT 1,
  display_order              INT,
  created_at                 TIMESTAMP(6),
  updated_at                 TIMESTAMP(6),
  UNIQUE KEY uk_blr (tenant_id, business_location_code, rule_key, effective_from),
  KEY idx_blr_loc_display (business_location_code, is_displayed_on_dashboard, display_order)
);
```

**初期データ例 (関空)**

| rule_type | rule_key | rule_value | rule_description |
|---|---|---|---|
| CUTOFF_TIME | TSUKAI_CUTOFF | 15:00 | 保税側15時突合カット |
| DAILY_POLICY | PROCESS_DEFAULT | 当日 | データ夜間着→朝7時出勤、昼過ぎ着まで当日搬出 |
| PRIORITY_POLICY | DEFAULT_PRIORITY | BIN→PKG | 進捗優先順位 |

### 1.6 `business_route` — 処理ルートマスタ

`base.md §2.2` の集約/非集約/特定顧客ルート。

```sql
CREATE TABLE business_route (
  code                    VARCHAR(32)  NOT NULL PRIMARY KEY, -- AGGREGATED_NORMAL / AGGREGATED_HEAVY / NON_AGGREGATED / TOKYO_STANDARD
  name_ja                 VARCHAR(128) NOT NULL,
  description             VARCHAR(500),
  business_location_code  VARCHAR(16),
  typical_step_order      JSON,                              -- ['HS_CHECK','CLEANSING','NACCS']
  is_active               TINYINT(1)   DEFAULT 1
);
```

### 1.7 `responsibility_party` — 責任部署マスタ

§7.2 #9 持ち戻り後の責任部署別件数で使用。

```sql
CREATE TABLE responsibility_party (
  code         VARCHAR(32) NOT NULL PRIMARY KEY, -- DELIVERY_DEPT / CS / CUSTOMS_TEAM / BONDED_TEAM 等
  name_ja      VARCHAR(64) NOT NULL,
  is_active    TINYINT(1)  DEFAULT 1,
  display_order INT
);
```

### 1.8 `aging_bucket_definition` — 時間バケット定義

モックの滞留時間バケット (24h/48h/1w/2w/4w-/4w+) を DB 管理。将来の境界変更を柔軟化。

```sql
CREATE TABLE aging_bucket_definition (
  code         VARCHAR(16) NOT NULL PRIMARY KEY, -- BUCKET_24H / BUCKET_48H / BUCKET_1W / BUCKET_2W / BUCKET_4W_UNDER / BUCKET_4W_OVER
  label_ja     VARCHAR(32) NOT NULL,             -- '24h' / '48h' / '1週' / '2週' / '4週未満' / '4週以上'
  min_hours    INT         NOT NULL,             -- 0/24/48/168/336/672
  max_hours    INT,                              -- NULL = 上限なし
  sort_order   INT         NOT NULL,
  color_token  VARCHAR(16),                      -- 'normal'/'warn'/'critical'
  is_critical  TINYINT(1)  DEFAULT 0             -- 4週以上は終了系判断対象=true
);
```

**初期データ**

| code | label_ja | min_hours | max_hours | is_critical |
|---|---|---|---|---|
| BUCKET_24H | 24h | 0 | 24 | 0 |
| BUCKET_48H | 48h | 24 | 48 | 0 |
| BUCKET_1W | 1週 | 48 | 168 | 0 |
| BUCKET_2W | 2週 | 168 | 336 | 0 |
| BUCKET_4W_UNDER | 4週未満 | 336 | 672 | 0 |
| BUCKET_4W_OVER | 4週以上 | 672 | NULL | **1** |

### 1.9 `dwell_location_definition` — 滞留場所マスタ

モックの滞留ランキング (クレンジング前滞留/NACCS準備待ち/申告不備在庫/許可済み未搬出/未申告在庫/審査対応中) の**解消条件テキスト**を保持。

```sql
CREATE TABLE dwell_location_definition (
  code                    VARCHAR(64)  NOT NULL PRIMARY KEY,
  -- CUSTOMS_PRE_CLEANSING / CUSTOMS_NACCS_PREP / CUSTOMS_FAIL_INVENTORY
  -- CUSTOMS_REVIEW_KUBUN23 / CUSTOMS_UNFILED / CUSTOMS_PERMIT_PENDING_SHIPOUT
  -- BONDED_OUT_PENDING_BIN / DELIVERY_HANDOVER_PENDING 等
  name_ja                 VARCHAR(128) NOT NULL,     -- '審査対応中（区分2/3）' 等
  category_code           VARCHAR(32)  NOT NULL,     -- → kpi_category
  from_process_step_code  VARCHAR(16),               -- 滞留が発生する工程
  to_process_step_code    VARCHAR(16),               -- 解消後の遷移先工程
  exit_condition_text     VARCHAR(255),              -- "回答/検査→許可で復帰" 等 (モック表示用)
  escalation_after_hours  INT,                       -- 滞留時間がこれを超えるとアラート対象
  display_order           INT,
  description             TEXT,
  is_active               TINYINT(1)   DEFAULT 1
);
```

**初期データ (モック関空版 6種)**

| code | name_ja | exit_condition_text | escalation_after_hours |
|---|---|---|---|
| CUSTOMS_REVIEW_KUBUN23 | 審査対応中（区分2/3） | 回答/検査→許可で復帰 | 672 |
| CUSTOMS_NACCS_PREP | NACCS準備待ち | 準備完了で申告へ | 48 |
| CUSTOMS_FAIL_INVENTORY | 申告不備在庫 | うち4週間以上11・解消→再申請 | 336 |
| CUSTOMS_PERMIT_PENDING_SHIPOUT | 許可済み未搬出 | 当日集荷で解消 | 24 |
| CUSTOMS_UNFILED | 未申告在庫（BIN未達） | 翌日朝の優先処理 | 24 |
| CUSTOMS_PRE_CLEANSING | クレンジング前滞留 | 処理能力内 | 48 |

### 1.10 `staffing_role` — 体制ロールマスタ

モックの「体制: 通関士6＋加工9」表示用。

```sql
CREATE TABLE staffing_role (
  code          VARCHAR(32) NOT NULL PRIMARY KEY, -- CUSTOMS_OFFICER / PROCESSING_STAFF / DRIVER / SORTER / BONDED_STAFF
  name_ja       VARCHAR(64) NOT NULL,             -- '通関士' / '加工' / 'ドライバー' '仕分け' 等
  category_code VARCHAR(32) NOT NULL,             -- → kpi_category
  display_order INT,
  is_active     TINYINT(1)  DEFAULT 1
);
```

---

## 2. KPI 目標 (2表)

### 2.1 `kpi_target` — 目標値

```sql
CREATE TABLE kpi_target (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id               VARCHAR(16) NOT NULL,
  kpi_code                VARCHAR(64) NOT NULL,
  agency_id               BIGINT UNSIGNED,               -- NULL=テナント全体
  business_location_code  VARCHAR(16),                   -- NULL=全拠点
  business_route_code     VARCHAR(32),                   -- NULL=ルート問わず
  effective_from          DATE        NOT NULL,
  effective_to            DATE,
  target_value            DECIMAL(20,4) NOT NULL,        -- 目標値 (0.95 = 95%)
  warning_threshold       DECIMAL(20,4),                 -- 警告閾値 (0.90)
  critical_threshold      DECIMAL(20,4),                 -- 危険閾値 (0.85)
  comparison_operator     VARCHAR(4)  NOT NULL DEFAULT '>=', -- '>=' / '<=' / '==' / '>' / '<'
  target_basis            VARCHAR(32),                   -- BUSINESS_GOAL / SLA_CONTRACT / SOCIAL_NORM / HISTORICAL
  created_at              TIMESTAMP(6),
  updated_at              TIMESTAMP(6),
  created_by              VARCHAR(64),
  approved_by             VARCHAR(64),
  approved_at             TIMESTAMP(6),
  notes                   VARCHAR(500),
  UNIQUE KEY uk_kpi_target (tenant_id, kpi_code, agency_id, business_location_code, business_route_code, effective_from),
  KEY idx_kpi_target_kpi (kpi_code, effective_from DESC)
);
```

### 2.2 `kpi_target_history` — 目標変更履歴

```sql
CREATE TABLE kpi_target_history (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kpi_target_id         BIGINT UNSIGNED NOT NULL,
  changed_at            TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  changed_by            VARCHAR(64),
  before_target_value   DECIMAL(20,4),
  after_target_value    DECIMAL(20,4),
  before_warning        DECIMAL(20,4),
  after_warning         DECIMAL(20,4),
  before_critical       DECIMAL(20,4),
  after_critical        DECIMAL(20,4),
  change_reason         VARCHAR(500),
  KEY idx_kth_target (kpi_target_id, changed_at DESC)
);
```

---

## 3. 実績値・滞留 (6表)

### 3.1 `kpi_actual` — 実績値 (**ダッシュボード表示の中核**)

日次バッチが書き込む。ダッシュボードはこのテーブルを SELECT して表示する。

```sql
CREATE TABLE kpi_actual (
  id                      BIGINT UNSIGNED AUTO_INCREMENT,
  tenant_id               VARCHAR(16)   NOT NULL,
  kpi_code                VARCHAR(64)   NOT NULL,
  -- ディメンション (NULL=該当軸で集計しない)
  agency_id               BIGINT UNSIGNED,
  business_location_code  VARCHAR(16),
  business_route_code     VARCHAR(32),
  -- 時間軸
  bucket_date             DATE          NOT NULL,    -- JST 日付
  bucket_hour             TINYINT,                   -- 0-23 JST、NULL=日次集計
  -- 実績値
  numerator               DECIMAL(20,4),             -- 分子 (例: 許可件数)
  denominator             DECIMAL(20,4),             -- 分母 (例: 申告件数、率 KPI 用)
  actual_value            DECIMAL(20,4) NOT NULL,    -- 実績値 (0.95)
  sample_count            INT,                       -- 対象件数
  -- メタ
  computed_at             TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  aggregation_job_id      BIGINT UNSIGNED,
  PRIMARY KEY (id, bucket_date),                     -- パーティション対応
  UNIQUE KEY uk_kpi_actual (kpi_code, tenant_id, agency_id, business_location_code, business_route_code, bucket_date, bucket_hour),
  KEY idx_kpi_actual_query (kpi_code, tenant_id, business_location_code, bucket_date DESC)
) PARTITION BY RANGE (TO_DAYS(bucket_date)) (
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

> **PG 版**: `PARTITION BY RANGE (bucket_date)` を declarative partitioning で実装、`pg_partman` で月次自動追加。

### 3.2 `kpi_actual_breakdown` — 実績内訳

モックの「フロー分岐結果」(区分1/2/3別件数)、「持ち戻り理由別件数」等のドリルダウン用。

```sql
CREATE TABLE kpi_actual_breakdown (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kpi_actual_id        BIGINT UNSIGNED NOT NULL,
  tenant_id            VARCHAR(16)     NOT NULL,
  breakdown_dimension  VARCHAR(32)     NOT NULL, -- KUBUN / CARRIER / DRIVER / CUSTOMER / FAIL_REASON
                                                  -- / RESPONSIBILITY_PARTY / DWELL_SUBSTATE / FAIL_SUB_CATEGORY
  breakdown_key        VARCHAR(64)     NOT NULL, -- '1' / '2' / '3' (区分の値) 等
  breakdown_label      VARCHAR(255),             -- 表示名 '区分1' '佐川急便' 等
  actual_value         DECIMAL(20,4),
  sub_count            INT,
  KEY idx_kab_actual (kpi_actual_id, breakdown_dimension)
);
```

### 3.3 `stage_dwell_snapshot` — 滞留量日次断面

モックの滞留ランキング・フロー上の滞留ノードのデータソース。日次 2 回 (07:00 + 23:00) バッチで更新。

```sql
CREATE TABLE stage_dwell_snapshot (
  id                      BIGINT UNSIGNED AUTO_INCREMENT,
  tenant_id               VARCHAR(16)   NOT NULL,
  snapshot_at             TIMESTAMP(6)  NOT NULL,         -- 集計時刻
  -- 滞留場所識別
  dwell_location_code     VARCHAR(64),                    -- → dwell_location_definition
  from_step_code          VARCHAR(16),                    -- 工程ペアでも識別可
  to_step_code            VARCHAR(16),
  -- ディメンション
  agency_id               BIGINT UNSIGNED,
  business_location_code  VARCHAR(16),
  -- 件数
  total_count             INT           NOT NULL DEFAULT 0,
  -- 時間バケット (モック必須)
  bucket_24h_count        INT           NOT NULL DEFAULT 0,
  bucket_48h_count        INT           NOT NULL DEFAULT 0,
  bucket_1w_count         INT           NOT NULL DEFAULT 0,
  bucket_2w_count         INT           NOT NULL DEFAULT 0,
  bucket_4w_under_count   INT           NOT NULL DEFAULT 0,
  bucket_4w_over_count    INT           NOT NULL DEFAULT 0,
  -- 統計補助 (傾向把握用)
  avg_dwell_minutes       DECIMAL(15,2),
  p50_dwell_minutes       DECIMAL(15,2),
  p95_dwell_minutes       DECIMAL(15,2),
  p99_dwell_minutes       DECIMAL(15,2),
  oldest_entered_at       TIMESTAMP(6),                   -- 最古滞留貨物の進入時刻
  -- メタ
  aggregation_job_id      BIGINT UNSIGNED,
  PRIMARY KEY (id, snapshot_at),
  UNIQUE KEY uk_sds (snapshot_at, dwell_location_code, from_step_code, to_step_code, tenant_id, agency_id, business_location_code),
  KEY idx_sds_query    (tenant_id, business_location_code, snapshot_at DESC, dwell_location_code),
  KEY idx_sds_critical (tenant_id, snapshot_at, bucket_4w_over_count)
) PARTITION BY RANGE (TO_DAYS(snapshot_at)) (
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

### 3.4 `issue_aging_snapshot` — 申告不備の分類×時間ヒートマップ

モック右ペインの「申告不備在庫(分類×経過時間)」ヒートマップのデータソース。  
`issue` テーブルへの `fail_sub_category` 列追加 (§3.5) が前提。

```sql
CREATE TABLE issue_aging_snapshot (
  id                      BIGINT UNSIGNED AUTO_INCREMENT,
  tenant_id               VARCHAR(16)  NOT NULL,
  snapshot_at             TIMESTAMP(6) NOT NULL,
  business_location_code  VARCHAR(16),
  agency_id               BIGINT UNSIGNED,
  -- 分類
  issue_kind              VARCHAR(32)  NOT NULL, -- 'CUSTOMS_FAIL' (申告不備)
  fail_sub_category       VARCHAR(32)  NOT NULL, -- PRE_PROCESS / PLATFORM_CHECK / DOCUMENT_PREP / APPLY_IMPOSSIBLE
  fail_sub_status         VARCHAR(32),           -- 書類準備中の更に内訳: UNPROCESSED/ISSUING/PF_CHECK/REAPPLY_PENDING
  -- 時間バケット
  bucket_24h_count        INT          NOT NULL DEFAULT 0,
  bucket_48h_count        INT          NOT NULL DEFAULT 0,
  bucket_1w_count         INT          NOT NULL DEFAULT 0,
  bucket_2w_count         INT          NOT NULL DEFAULT 0,
  bucket_4w_under_count   INT          NOT NULL DEFAULT 0,
  bucket_4w_over_count    INT          NOT NULL DEFAULT 0,
  total_count             INT          NOT NULL DEFAULT 0,
  aggregation_job_id      BIGINT UNSIGNED,
  PRIMARY KEY (id, snapshot_at),
  UNIQUE KEY uk_ias (snapshot_at, tenant_id, business_location_code, agency_id, issue_kind, fail_sub_category, fail_sub_status),
  KEY idx_ias_query (tenant_id, business_location_code, snapshot_at DESC, issue_kind)
) PARTITION BY RANGE (TO_DAYS(snapshot_at)) (
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

**`fail_sub_category` 値一覧**

| 値 | 説明 |
|---|---|
| PRE_PROCESS | 未処理(振分前) |
| PLATFORM_CHECK | プラットフォーム確認中 |
| DOCUMENT_PREP | 書類準備中 |
| APPLY_IMPOSSIBLE | 申請不可 |

**`fail_sub_status` 値一覧** (DOCUMENT_PREP 時のみ意味あり)

| 値 | 説明 |
|---|---|
| UNPROCESSED | 未処理 |
| ISSUING | 発行手続き中 |
| PF_CHECK | PF確認中 |
| REAPPLY_PENDING | 処理済み(再申請待ち) |

### 3.5 既存 `issue` テーブルへの列追加

申告不備の分類対応のため 2 列追加。

```sql
ALTER TABLE issue
  ADD COLUMN fail_sub_category VARCHAR(32), -- PRE_PROCESS / PLATFORM_CHECK / DOCUMENT_PREP / APPLY_IMPOSSIBLE
  ADD COLUMN fail_sub_status   VARCHAR(32), -- 書類準備中の内訳: UNPROCESSED/ISSUING/PF_CHECK/REAPPLY_PENDING
  ADD KEY idx_issue_fail_category (issue_kind, fail_sub_category, fail_sub_status);
```

### 3.6 `staffing_actual_daily` — 体制実績

モックの「体制: 通関士6＋加工9」「人件費速報612千円」の元データ。

```sql
CREATE TABLE staffing_actual_daily (
  id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id               VARCHAR(16)   NOT NULL,
  snapshot_date           DATE          NOT NULL,
  business_location_code  VARCHAR(16)   NOT NULL,
  agency_id               BIGINT UNSIGNED,
  role_code               VARCHAR(32)   NOT NULL,  -- → staffing_role
  planned_count           INT,                     -- 計画人数
  actual_count            INT           NOT NULL,  -- 実績人数
  absent_count            INT           DEFAULT 0,
  overtime_hours          DECIMAL(8,2)  DEFAULT 0, -- 速報原価計算用
  cost_per_person_jpy     DECIMAL(15,2),           -- 1人あたり日次標準単価
  total_cost_forecast_jpy DECIMAL(15,2),           -- actual_count × cost_per_person
  notes                   VARCHAR(500),
  created_at              TIMESTAMP(6),
  updated_at              TIMESTAMP(6),
  UNIQUE KEY uk_sad (tenant_id, snapshot_date, business_location_code, agency_id, role_code),
  KEY idx_sad_loc_date (business_location_code, snapshot_date DESC)
);
```

### 3.7 `kpi_aggregation_job` — 集計バッチログ

```sql
CREATE TABLE kpi_aggregation_job (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(16),
  job_name      VARCHAR(128) NOT NULL, -- 'dwell_aging_snapshot_job' / 'issue_aging_snapshot_job'
                                        -- 'productivity_kpi_job' / 'cost_forecast_kpi_job' / 'backflow_count_job'
  job_type      VARCHAR(32),            -- KPI / SNAPSHOT / EVALUATION
  kpi_codes     JSON,                   -- 対象 KPI list (NULL=全件)
  target_date   DATE,
  window        VARCHAR(16),            -- DAILY / HOURLY / SNAPSHOT
  status        VARCHAR(16)  NOT NULL DEFAULT 'RUNNING', -- RUNNING / SUCCESS / FAILED / PARTIAL
  started_at    TIMESTAMP(6) NOT NULL,
  completed_at  TIMESTAMP(6),
  duration_ms   BIGINT,
  rows_written  BIGINT       DEFAULT 0,
  error_message TEXT,
  triggered_by  VARCHAR(64), -- 'cron' / 'manual' / account_id
  KEY idx_kaj_status    (status, started_at DESC),
  KEY idx_kaj_name_date (job_name, target_date DESC)
);
```

---

## 4. アラートエンジン (3表)

### 4.1 `alert_rule` — 発火ルール

```sql
CREATE TABLE alert_rule (
  id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id                   VARCHAR(16)  NOT NULL,
  code                        VARCHAR(64)  NOT NULL,
  kpi_code                    VARCHAR(64)  NOT NULL,
  agency_id                   BIGINT UNSIGNED,
  business_location_code      VARCHAR(16),
  threshold_level             VARCHAR(16)  NOT NULL,     -- WARNING / CRITICAL
  evaluation_window_minutes   INT          NOT NULL DEFAULT 1440, -- 5/60/1440 等
  persistence_count           INT          NOT NULL DEFAULT 1,    -- N回連続違反で発火
  cooldown_minutes            INT          NOT NULL DEFAULT 60,   -- 再発火抑止時間
  severity                    VARCHAR(16)  NOT NULL,     -- LOW / MEDIUM / HIGH / URGENT
  -- メッセージテンプレート (モック対応)
  title_template              VARCHAR(255),              -- '${kpi_name}が${actual_value}で目標${target_value}未達'
  body_template               TEXT,                      -- 詳細テンプレート、${変数}を展開
  is_active                   TINYINT(1)   NOT NULL DEFAULT 1,
  description                 TEXT,
  created_at                  TIMESTAMP(6),
  updated_at                  TIMESTAMP(6),
  created_by                  VARCHAR(64),
  updated_by                  VARCHAR(64),
  UNIQUE KEY uk_alert_rule (tenant_id, code),
  KEY idx_alert_rule_kpi (kpi_code, is_active)
);
```

### 4.2 `alert_instance` — 発火したアラート

```sql
CREATE TABLE alert_instance (
  id                          BIGINT UNSIGNED AUTO_INCREMENT,
  tenant_id                   VARCHAR(16)  NOT NULL,
  alert_rule_id               BIGINT UNSIGNED NOT NULL,
  kpi_actual_id               BIGINT UNSIGNED,               -- 直接原因の実績値
  triggered_at                TIMESTAMP(6)    NOT NULL,
  actual_at_trigger           DECIMAL(20,4),                 -- 違反時の実績値
  target_at_trigger           DECIMAL(20,4),                 -- 違反時の目標値
  status                      VARCHAR(16)  NOT NULL DEFAULT 'OPEN', -- OPEN/ACKNOWLEDGED/RESOLVED/SNOOZED
  severity                    VARCHAR(16)  NOT NULL,          -- rule から複製、後で変更可
  -- 展開後のメッセージ
  title                       VARCHAR(500),
  body                        TEXT,
  template_variables_json     JSON,                          -- 展開時の変数値、再生成可能
  payload_json                JSON,                          -- 詳細データ (breakdown 等)
  -- 確認・解決
  acknowledged_at             TIMESTAMP(6),
  acknowledged_by_account_id  BIGINT UNSIGNED,
  resolved_at                 TIMESTAMP(6),
  resolved_by_account_id      BIGINT UNSIGNED,
  resolution_notes            TEXT,
  snoozed_until               TIMESTAMP(6),
  auto_resolved               TINYINT(1)   DEFAULT 0,        -- KPI 回復で自動解決
  created_at                  TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id, triggered_at),
  KEY idx_ai_status (tenant_id, status, severity, triggered_at DESC),
  KEY idx_ai_rule   (alert_rule_id, triggered_at DESC)
) PARTITION BY RANGE (TO_DAYS(triggered_at)) (
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

### 4.3 `alert_acknowledgement` — 確認操作履歴

```sql
CREATE TABLE alert_acknowledgement (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  alert_instance_id   BIGINT UNSIGNED NOT NULL,
  tenant_id           VARCHAR(16)     NOT NULL,
  account_id          BIGINT UNSIGNED NOT NULL,
  action              VARCHAR(16)     NOT NULL, -- ACKNOWLEDGE / SNOOZE / RESOLVE / REOPEN / COMMENT
  comment             TEXT,
  performed_at        TIMESTAMP(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_aa_instance (alert_instance_id, performed_at DESC),
  KEY idx_aa_account  (account_id, performed_at DESC)
);
```

---

## 5. 通知配信 (3表)

### 5.1 `alert_channel` — 通知チャネル定義

```sql
CREATE TABLE alert_channel (
  id                   BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id            VARCHAR(16)  NOT NULL,
  code                 VARCHAR(64)  NOT NULL, -- 'slack_ops' / 'line_managers' 等
  type                 VARCHAR(16)  NOT NULL, -- SLACK / LINE / EMAIL / SMS / IN_APP / WEBHOOK
  name                 VARCHAR(128) NOT NULL,
  config_kms_key       VARCHAR(255),           -- Webhook URL / アクセストークン (KMS 暗号化)
  config_json          JSON,                  -- 非機密設定 (channel_id / from_email 等)
  is_active            TINYINT(1)   NOT NULL DEFAULT 1,
  rate_limit_per_minute INT         DEFAULT 60,
  daily_quota          INT,                   -- 1日の上限 (LINE push quota 等)
  daily_sent_count     INT          DEFAULT 0,-- 当日送信数
  quota_reset_at       DATE,
  UNIQUE KEY uk_ac (tenant_id, code)
);
```

### 5.2 `alert_routing_rule` — 通知ルーティング

```sql
CREATE TABLE alert_routing_rule (
  id                                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tenant_id                           VARCHAR(16)  NOT NULL,
  code                                VARCHAR(64),
  -- マッチング条件
  alert_rule_id                       BIGINT UNSIGNED, -- NULL=全アラート対象
  kpi_code                            VARCHAR(64),     -- NULL=全 KPI
  severity_min                        VARCHAR(16),     -- 'MEDIUM' 以上等
  agency_id                           BIGINT UNSIGNED,
  business_location_code              VARCHAR(16),
  time_window_start                   TIME,            -- 9:00-21:00 等
  time_window_end                     TIME,
  -- 配信先
  channel_id                          BIGINT UNSIGNED NOT NULL,
  recipient_type                      VARCHAR(16)  NOT NULL, -- ROLE / ACCOUNT / SLACK_CHANNEL / LINE_GROUP / EMAIL_LIST
  recipient_value                     VARCHAR(255) NOT NULL, -- role_id / account_id / '#ops-alerts' / 'ops@x.com'
  -- エスカレーション
  escalation_after_minutes            INT,
  escalation_target_routing_rule_id   BIGINT UNSIGNED, -- N分応答無いと次のルールへ
  is_active                           TINYINT(1)   NOT NULL DEFAULT 1,
  priority                            INT          DEFAULT 100, -- 同時マッチ時の優先度
  description                         VARCHAR(500),
  KEY idx_arr_match (tenant_id, alert_rule_id, kpi_code, is_active)
);
```

### 5.3 `alert_notification_dispatch` — 送信履歴

```sql
CREATE TABLE alert_notification_dispatch (
  id                    BIGINT UNSIGNED AUTO_INCREMENT,
  alert_instance_id     BIGINT UNSIGNED NOT NULL,
  routing_rule_id       BIGINT UNSIGNED NOT NULL,
  channel_id            BIGINT UNSIGNED NOT NULL,
  tenant_id             VARCHAR(16)     NOT NULL,
  recipient_value       VARCHAR(255)    NOT NULL,
  message_body          TEXT,                               -- 実送信した本文 (テンプレ展開済み)
  status                VARCHAR(16)     NOT NULL DEFAULT 'PENDING',
                                                            -- PENDING/SENT/FAILED/SKIPPED_DND/RATE_LIMITED/QUOTA_EXCEEDED
  attempt_count         INT             NOT NULL DEFAULT 0,
  max_attempts          INT             DEFAULT 3,
  last_attempt_at       TIMESTAMP(6),
  next_retry_at         TIMESTAMP(6),
  sent_at               TIMESTAMP(6),
  delivered_at          TIMESTAMP(6),                      -- 配信確認 webhook
  read_at               TIMESTAMP(6),                      -- 既読
  response_payload_json JSON,                              -- Slack msg ID / LINE request ID 等
  error_code            VARCHAR(64),
  error_message         TEXT,
  created_at            TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id, created_at),
  KEY idx_and_instance (alert_instance_id, created_at DESC),
  KEY idx_and_pending  (status, next_retry_at)
) PARTITION BY RANGE (TO_DAYS(created_at)) (
  PARTITION p202607 VALUES LESS THAN (TO_DAYS('2026-08-01')),
  PARTITION pmax    VALUES LESS THAN MAXVALUE
);
```

---

## 6. アラート発火・通知の運用シーケンス

```
日次バッチ (kpi_aggregation_job)
└─► kpi_actual INSERT (実績値書込み)
    └─► kpi_evaluation_engine が kpi_target と比較
        ├─ kpi_target.warning_threshold / critical_threshold チェック
        ├─ alert_rule の persistence_count 確認 (N回連続違反?)
        ├─ cooldown_minutes チェック (再発火抑止期間内?)
        └─ 違反継続 → alert_instance INSERT (status=OPEN) + テンプレ展開 (title/body)
            └─► alert_routing_rule マッチング
                ├─ kpi_code / severity_min / time_window で絞込
                └─► alert_notification_dispatch INSERT (channel別)
                    ├─ SLACK  → Webhook POST → 成功時 sent_at
                    ├─ LINE   → Messaging API push → 成功時 sent_at
                    ├─ EMAIL  → SES 送信
                    ├─ IN_APP → admin_notification INSERT
                    └─ WEBHOOK → 任意エンドポイント
                        └─► (escalation_after_minutes 経過後)
                            ├─ acknowledged_at IS NULL チェック
                            └─► alert_routing_rule.escalation_target で上位者へ
                    └─► alert_acknowledgement (ACK 操作で停止)
                        └─► alert_instance.status='ACKNOWLEDGED'
```

**自動解決**: 次回集計で `kpi_actual.actual_value` が閾値を下回らなくなれば → 自動 `alert_instance.status=RESOLVED, auto_resolved=true`

---

## 7. 集計バッチ運用

### 7.1 バッチジョブ一覧

| ジョブ名 | 集計対象 | 出力テーブル | 頻度 | 起動時刻 (JST) |
|---|---|---|---|---|
| `count_kpi_job` | shipment_event → 件数/率系 | `kpi_actual` | 日次 | 00:30 |
| `dwell_aging_snapshot_job` | shipment_event → 滞留バケット分布 | `stage_dwell_snapshot` | 日次2回 | 07:00 + 23:00 |
| `issue_aging_snapshot_job` | issue → 分類×時間 | `issue_aging_snapshot` | 日次2回 | 07:00 + 23:00 |
| `productivity_kpi_job` | shipment_event + staffing_actual_daily | `kpi_actual` 生産性系 | 日次 | 01:00 |
| `cost_forecast_kpi_job` | 単価マスタ × kpi_actual (件数) | `kpi_actual` 原価系 | 日次 | 01:30 |
| `backflow_count_job` | shipment_event 復帰系遷移 | `kpi_actual` 復帰系 | 日次 | 01:00 |
| `hourly_progress_job` | shipment_event 時間帯別 | `kpi_actual` (bucket_hour付) | 時次 | 毎時05分 |
| `kpi_evaluation_job` | kpi_actual ↔ kpi_target 比較 | `alert_instance` (新規発火) | 日次+時次 | 集計直後 |
| `notification_dispatch_job` | alert_notification_dispatch | 外部API送信 | 5分毎 | 連続 |
| `auto_resolve_job` | OPEN alert で値回復したもの | `alert_instance.auto_resolved` | 日次 | 02:00 |

### 7.2 base.md §5.5 運用ルール踏襲

- **カウント基準**: HPK 時点を基準に当日作業量を集計 (翌日作業分は含めない)
- **速報値**: 標準単価×件数 (毎日更新)
- **確定値**: マネーフォワード支払請求 (翌月10日以降取込、Phase 2)
- **検算**: 前月確定値と速報計算の差分チェック → 乖離大きい場合は標準単価再検討

### 7.3 更新頻度別の戦略 (リアルタイム / 頻次 / 日次)

#### 7.3.1 更新頻度の4分類

| 頻度 | アプローチ | 鮮度 | 例 (配送中心) |
|---|---|---|---|
| **R: リアルタイム (秒)** | A. ソース直接 SELECT | < 数秒 | 配達中件数 / 本日持ち戻り / 本日再配達 / 集荷成功・失敗 / イレギュラー発生 / OPEN アラート |
| **N: 準リアルタイム (1〜5分)** | B. イベント駆動増分更新 (`kpi_actual.bucket_hour` UPSERT) | 数秒〜分 | 仕分け進捗 / Chute NO_DATA / 配送業者別ステータス推移 |
| **H: 時次 (1時間)** | C. 時次バッチ (`hourly_progress_job`) | 最大1時間 | 24h完了率の時間帯別進捗 / 当日処理率推移 |
| **D: 日次 (確定)** | D. 日次バッチ (`count_kpi_job` 等 §7.1) | 最大24時間 | 当日処理率 / 許可率 / 人時生産性 / 単価 |

`kpi_definition.aggregation_window` の値域を拡張: `REALTIME` / `NEAR_REALTIME` / `HOURLY` / `DAILY` / `MONTHLY`

#### 7.3.2 A. ソース直接 SELECT (リアルタイム)

```sql
-- 例1: 現在の配達中件数
SELECT COUNT(*) AS in_transit_count
FROM shipment
WHERE tenant_id = :tenant AND current_state = 'IN_TRANSIT' AND deleted_at IS NULL;

-- 例2: 本日の再配達件数 (再配達申請済み)
SELECT COUNT(*) AS redelivery_requested_today
FROM re_delivery_register
WHERE create_time >= CURDATE();

-- 例3: 本日の再配達完了件数
SELECT COUNT(*) AS redelivery_completed_today
FROM shipment_event
WHERE tenant_id = :tenant AND event_type = 'REDELIVERY_COMPLETED' AND DATE(occurred_at) = CURDATE();

-- 例4: 本日の持ち戻り発生件数
SELECT COUNT(*) FROM shipment_event
WHERE event_type IN ('RETURNED_TO_OFFICE', 'DELIVERY_FAILED') AND DATE(occurred_at) = CURDATE();

-- 例5: 本日の集荷成功・失敗
SELECT SUM(CASE WHEN relation_status = 1 THEN 1 ELSE 0 END) AS success,
       SUM(CASE WHEN relation_status = 2 THEN 1 ELSE 0 END) AS failed
FROM pickup_task_hawb
WHERE DATE(operated_at) = CURDATE();
```

クライアント側は WebSocket or ポーリング (3〜10秒間隔) で取得。PG なら `LISTEN/NOTIFY` で push 可。

#### 7.3.3 B. イベント駆動増分更新 (準リアルタイム)

```
shipment_event INSERT
└─► domain_event outbox に投入
    └─► Streaming Worker (SQS/Kinesis consumer)
        └─► UPSERT kpi_actual
            - kpi_code 別に numerator +=1 / actual_value 再計算
            - WHERE kpi_code = ? AND bucket_date = CURDATE() AND bucket_hour = HOUR(NOW())
            - 例: DELIVERY_COMPLETED_COUNT, REDELIVERY_REQUESTED_COUNT
```

#### 7.3.4 トレードオフ比較

| 観点 | A. 直接クエリ | B. イベント駆動増分 | C. 時次バッチ | D. 日次バッチ |
|---|---|---|---|---|
| 鮮度 | 秒以内 | 数秒 | 最大1時間 | 最大24時間 |
| DB負荷 | 高 (毎回 COUNT/JOIN) | 中 (UPSERT毎回) | 低 (時次1回) | 最低 |
| 実装複雑度 | 低 (素直なSELECT) | 高 (Streaming Worker要) | 中 | 低 |
| 履歴参照 | 不可 (現在値のみ) | 可 (`kpi_actual` 蓄積) | 可 | 可 |
| 適用基準 | 「現在何件か」「本日累計」 | 「KPI履歴も欲しいが鮮度も」 | 時間帯別推移 | 確定値・複雑指標 |

#### 7.3.5 配送・集荷リアルタイム KPI 一覧 (A方式推奨)

| KPI | アプローチ | 直接 SELECT の対象 |
|---|---|---|
| 配達中件数 | A | `shipment WHERE current_state='IN_TRANSIT'` |
| 本日配達完了件数 | A | `shipment_event WHERE event_type='DELIVERED' AND DATE(occurred_at)=CURDATE()` |
| 本日持ち戻り件数 | A | `shipment_event WHERE event_type='RETURNED_TO_OFFICE'` (本日) |
| 本日配達失敗件数 | A | `shipment_event WHERE event_type='DELIVERY_FAILED'` (本日) |
| 再配達申請件数 (登録済) | A | `re_delivery_register WHERE create_time >= CURDATE()` |
| 再配達完了件数 | A | `shipment_event WHERE event_type='REDELIVERY_COMPLETED'` (本日) |
| イレギュラー発生件数 | A | `issue WHERE create_time >= 最終チェック` (差分検知) |
| 集荷成功率 (本日) | A | `pickup_task_hawb` 集計 |
| 集荷予定リスト (未訪問数) | A | `pickup_task + pickup_task_hawb WHERE relation_status=0` |
| Chute NO_DATA/異常 | A | `sort_order WHERE push_status=2 OR scan_status=0` |
| OPEN アラート件数 | A | `alert_instance WHERE status='OPEN'` |

---

## 8. ダッシュボード Widget タイプ

新規テーブルなし。`admin_dashboard_config.layout_json` の `widget_type` 拡張で対応 (DDL 変更なし)。

### 8.1 KPI/フロー系 Widget

| widget_type | 用途 | データソース |
|---|---|---|
| `kpi_card` | 単一 KPI 値カード | `kpi_actual` + `kpi_target` |
| `kpi_card_compact` | KPI カード横並び (モック上段7枚) | 複数 `kpi_actual` |
| `kpi_trend_chart` | 期間トレンド折れ線 | `kpi_actual` (期間SELECT) |
| `kpi_breakdown_pie` | 内訳円グラフ | `kpi_actual_breakdown` |
| `flow_diagram` | 業務フロー縦+件数+色分け (モック左ペイン) | `kpi_actual` + `stage_dwell_snapshot` + `process_step` |
| `stage_funnel` | 工程漏斗表示 | `kpi_actual` (連続step) |

### 8.2 滞留・ヒートマップ系 Widget

| widget_type | 用途 | データソース |
|---|---|---|
| `dwell_ranking` | 滞留ランキング+バー+解消条件 (モック右ペイン) | `stage_dwell_snapshot` + `dwell_location_definition` |
| `aging_heatmap` | 分類×時間ヒートマップ (モック申告不備) | `issue_aging_snapshot` |
| `stage_dwell_heatmap` | 工程ペア×時間ヒートマップ | `stage_dwell_snapshot` |

### 8.3 生産性・コスト系 Widget

| widget_type | 用途 | データソース |
|---|---|---|
| `productivity_card` | 生産性カード群 (当日処理率/人時生産性/体制等) | `kpi_actual` 生産性系 + `staffing_actual_daily` |
| `cost_forecast_table` | 速報原価表 (人件費/単価/目標差) | `kpi_actual` コスト系 + `kpi_target` |
| `staffing_panel` | 体制表示 (通関士6+加工9) | `staffing_actual_daily` |

### 8.4 アラート・ルール系 Widget

| widget_type | 用途 | データソース |
|---|---|---|
| `alert_list` | severity 別アラート一覧 (モック右下) | `alert_instance` (status=OPEN) |
| `alert_summary_counts` | severity 別件数バッジ | `alert_instance` count |
| `location_rulebar` | 拠点ルール文字列 (モックヘッダ) | `business_location_rule` |
| `location_toggle` | 拠点切替トグル (モック上部) | `business_location` |

### 8.5 リアルタイム系 Widget (§7.3 A方式)

`kpi_actual` を経由せず**業務テーブル直接 SELECT** で値を取得する widget。  
WebSocket または短間隔ポーリング (3〜10秒) で更新。

| widget_type | 用途 | データソース (直接 SELECT) |
|---|---|---|
| `kpi_card_realtime` | 現在値カード (配達中件数 等) | アプリ層でソーステーブル COUNT |
| `delivery_redelivery_counter` | 本日再配達件数 (申請/完了 別) | `re_delivery_register` + `shipment_event` |
| `delivery_return_counter` | 本日持ち戻り発生件数 | `shipment_event WHERE event_type='RETURNED_TO_OFFICE'` |
| `delivery_in_transit_counter` | 現在配達中件数 + 業者別内訳 | `shipment WHERE current_state='IN_TRANSIT'` |
| `pickup_realtime_counter` | 本日集荷成功/失敗カウンタ | `pickup_task_hawb` |
| `irregular_live_feed` | イレギュラー発生フィード | `issue WHERE create_time >= 最終チェック` |
| `alert_list_live` | OPEN アラートのライブ更新 | `alert_instance` (status=OPEN) + WebSocket |
| `flow_diagram_realtime` | フロー各ノードの**現在値** | 各ノード状態を直接 COUNT |

> **使い分け**: §7.3.1 の更新頻度分類で R/N の KPI は §8.5 の widget、H/D の KPI は §8.1〜8.4 の通常 widget を使う。同一画面に混在可。

---

## 付録A. KPI カタログ初期データ

### A.1 通関カテゴリ (計 32 個)

#### 通過件数系 (10個 — モック明示)

| code | name_ja | metric_type | unit | process_step |
|---|---|---|---|---|
| CUSTOMS_RECEIVED_COUNT | データ受領件数 | COUNT | 件 | C-01 |
| CUSTOMS_CLEANSED_COUNT | クレンジング完了件数 | COUNT | 件 | C-06 |
| CUSTOMS_NACCS_PREPARED_COUNT | NACCS準備完了件数 | COUNT | 件 | C-07 |
| CUSTOMS_DECLARED_PRELIM_COUNT | 予備申告件数 | COUNT | 件 | C-08 |
| CUSTOMS_DECLARED_DIRECT_COUNT | 本申告直接件数 | COUNT | 件 | C-08 |
| CUSTOMS_DECLARED_TOTAL_COUNT | 申告済み合計 | COUNT | 件 | C-08 |
| CUSTOMS_PERMITTED_COUNT | 許可件数 | COUNT | 件 | C-09 |
| CUSTOMS_SHIPPED_OUT_COUNT | 搬出済件数 | COUNT | 件 | C-10 |
| CUSTOMS_RESUBMITTED_COUNT | 再申請件数 | COUNT | 件 | - |
| CUSTOMS_TERMINATED_COUNT | 終了系件数 (滅却/積戻し/撤回) | COUNT | 件 | - |

#### 分岐結果系 (7個 — モック明示)

| code | name_ja |
|---|---|
| CUSTOMS_KUBUN_1_COUNT | 税関区分1件数 |
| CUSTOMS_KUBUN_2_COUNT | 税関区分2件数 |
| CUSTOMS_KUBUN_3_COUNT | 税関区分3件数 |
| CUSTOMS_BIN_HIT_COUNT | BIN間に合い件数 |
| CUSTOMS_BIN_MISS_COUNT | BIN未達件数 |
| CUSTOMS_BIN_BACKFLOW_COUNT | BIN未達からの当日復帰件数 |
| CUSTOMS_REVIEW_BACKFLOW_COUNT | 区分2/3からの復帰件数 |

#### 率指標 (4個 — モック明示)

| code | name_ja | formula |
|---|---|---|
| CUSTOMS_BIN_HIT_RATE | BIN間に合い率 | CUSTOMS_BIN_HIT_COUNT / CUSTOMS_DECLARED_PRELIM_COUNT |
| CUSTOMS_PERMIT_RATE | 許可率 | CUSTOMS_PERMITTED_COUNT / CUSTOMS_DECLARED_TOTAL_COUNT |
| CUSTOMS_DAILY_PROCESSING_RATE | 当日処理率 | (当日許可件数) / (当日受領件数) |
| CUSTOMS_NEXT_DAY_PROCESSING_RATE | 翌日内処理率 | 関東版モックで表示、24h以内処理率 |

#### 滞留量 (6個 — モック明示)

| code | name_ja | dwell_location_code |
|---|---|---|
| CUSTOMS_PRE_CLEANSING_BACKLOG | クレンジング前滞留 | CUSTOMS_PRE_CLEANSING |
| CUSTOMS_NACCS_PREP_PENDING | NACCS準備待ち | CUSTOMS_NACCS_PREP |
| CUSTOMS_FAIL_INVENTORY_COUNT | 申告不備在庫 | CUSTOMS_FAIL_INVENTORY |
| CUSTOMS_REVIEW_PENDING_COUNT | 審査対応中(区分2/3) | CUSTOMS_REVIEW_KUBUN23 |
| CUSTOMS_UNFILED_INVENTORY_COUNT | 未申告在庫(BIN未達) | CUSTOMS_UNFILED |
| CUSTOMS_PERMIT_PENDING_SHIPOUT | 許可済み未搬出 | CUSTOMS_PERMIT_PENDING_SHIPOUT |

#### 生産性・原価 (5個 — モック明示)

| code | name_ja | metric_type | unit |
|---|---|---|---|
| CUSTOMS_RECEIVE_TO_PERMIT_HOURS | 到着→許可時間 | DURATION_HOURS | hour |
| CUSTOMS_PRODUCTIVITY_PER_PERSON_HOUR | 人時生産性 | RATE | 件/人時 |
| CUSTOMS_PERSONNEL_COST_FORECAST | 人件費速報 | COST_JPY | 千円 |
| CUSTOMS_UNIT_COST_PER_PERMIT | 許可1件単価 | COST_JPY | 円 |
| CUSTOMS_UNIT_COST_VS_TARGET_DIFF | 目標単価差 | COST_JPY | 円 (符号付き) |

### A.2 保税カテゴリ (12個)

| code | name_ja |
|---|---|
| BONDED_PKG_PENDING_OUT | PKG済み未OUT |
| BONDED_OUT_PENDING_BIN | OUT済み未BIN |
| BONDED_BIN_PENDING_HPK | BIN済み未HPK |
| BONDED_HPK_ERROR_COUNT | HPKエラー件数 |
| BONDED_PERMIT_PENDING_SHIPOUT | 許可済み未搬出 |
| BONDED_HOLD_ZONE_COUNT | 保留件数 |
| BONDED_HOLD_AGING_OVER_7D | 保留7日超件数 |
| BONDED_PICKUP_PENDING_NEXT_DAY | 翌日集荷待ち |
| BONDED_TERMINAL_24H_OVER_COUNT | ターミナル24h超過 |
| BONDED_STORAGE_FEE_UNBILLED | 未請求保管料 |
| BONDED_OLT_TO_OUT_DURATION | OLT→OUTリードタイム |
| BONDED_PLAN_VS_ACTUAL_VOLUME | 処理能力予実 |

### A.3 配送カテゴリ (14個)

| code | name_ja |
|---|---|
| DELIVERY_HANDOVER_PENDING | 配送部未引渡 |
| DELIVERY_SORTING_IN_PROGRESS | 仕分け中件数 |
| DELIVERY_CHUTE_NO_DATA_RATE | Chute NO_DATA率 |
| DELIVERY_LOADED_COUNT | 積込済件数 |
| DELIVERY_COMPLETE_RATE_24H | 24h完了率 |
| DELIVERY_RETURN_RATE | 持ち戻り率 |
| DELIVERY_RETURN_REASON_BREAKDOWN | 持ち戻り理由別 (breakdown_dimension=FAIL_REASON) |
| DELIVERY_ADDRESS_DEFECT_COUNT | 住所不備件数 |
| DELIVERY_DAMAGE_COUNT | 破損件数 |
| DELIVERY_RECOVERABLE_RATE | 復旧率 |
| DELIVERY_REDELIVERY_SLA_BREACH | 再配達SLA超過 |
| DELIVERY_VEHICLE_UTILIZATION | 車両稼働率 |
| DELIVERY_IRREGULAR_NOTIFY_DELAY | イレギュラー通知遅延 |
| DELIVERY_RESPONSIBILITY_PENDING | 責任部署別未解決 (breakdown_dimension=RESPONSIBILITY_PARTY) |

### A.4 集荷カテゴリ (10個)

| code | name_ja |
|---|---|
| PICKUP_REQUEST_COUNT_DAILY | 集荷依頼件数 |
| PICKUP_12HCUT_TODAY_RATIO | 12時カット当日比率 |
| PICKUP_CONTACT_PENDING_COUNT | 連絡未了件数 |
| PICKUP_DRIVER_ASSIGNED_RATE | アプリ配信済率 |
| PICKUP_SUCCESS_RATE | 集荷成功率 |
| PICKUP_FAILURE_REASON_BREAKDOWN | 失敗理由別件数 (breakdown_dimension=FAIL_REASON) |
| PICKUP_RESCHEDULE_RATE | 再集荷率 |
| PICKUP_TO_SORTING_LEAD_TIME | 集荷→配送投入LT |
| PICKUP_API_RETURN_FAILURE_RATE | PF API返送失敗率 |
| PICKUP_TODAY_PREDICTED_COUNT | 集荷予定数 |

### A.5 E2E/横断カテゴリ (5個)

| code | name_ja |
|---|---|
| E2E_DATA_RECEIPT_TO_DELIVERY_LT | 依頼〜配達完了E2E |
| E2E_LEAD_TIME_BREAKDOWN_BY_STAGE | 工程別時間分解 (breakdown_dimension=PROCESS_STEP) |
| SHARED_TABLE_UPDATE_DELAY | 共有表更新遅延 |
| TERMINATE_PROCESSING_IN_PROGRESS | 申告撤回・リシップ処理中 |
| INSPECTION_SCHEDULE_VS_RESULT | 検査スケジュール・結果 |

**合計**: 通関32 + 保税12 + 配送14 + 集荷10 + E2E5 = **73 KPI**

---

## 付録B. ギャップ候補 14件 対応マッピング

`business-flow.md §7.2` のギャップ候補 14件の対応。→ **14件全てが本設計で表現可能**。

| # | ギャップ候補 | 本DB上の表現 |
|---|---|---|
| 1 | OLT→OUTリードタイム | `kpi_definition` BONDED_OLT_TO_OUT_DURATION + `stage_dwell_snapshot` (OLT→OUT) |
| 2 | 横持ち中・倉庫到着遅延 | `stage_dwell_snapshot` (OUT→BIN) + `kpi_actual_breakdown.breakdown_dimension='DWELL_SUBSTATE'` |
| 3 | 当日計画vs実績 | `kpi_target` (planned_count) + `kpi_actual` (actual_count) を ratio で表現 |
| 4 | 人員計画vs物量 | `staffing_actual_daily.planned_count vs actual_count` (Phase 1 実装) |
| 5 | 処理ルート別進捗 | `kpi_actual.business_route_code` 次元 |
| 6 | 検査スケジュール・結果 | INSPECTION_SCHEDULE_VS_RESULT KPI + `kpi_actual_breakdown` で検査区分別 |
| 7 | 二次仕分け件数・収益 | DELIVERY_SECONDARY_SORT_COUNT (件数のみ、収益は Phase 2) |
| 8 | 再配達SLA | DELIVERY_REDELIVERY_SLA_BREACH + `alert_rule` で N周以上発生時発火 |
| 9 | 持ち戻り責任部署別 | DELIVERY_RESPONSIBILITY_PENDING + `kpi_actual_breakdown.breakdown_dimension='RESPONSIBILITY_PARTY'` |
| 10 | 集荷前工程滞留 | PICKUP_CONTACT_PENDING_COUNT |
| 11 | 集荷→配送投入LT | PICKUP_TO_SORTING_LEAD_TIME |
| 12 | E2Eリードタイム | E2E_DATA_RECEIPT_TO_DELIVERY_LT + E2E_LEAD_TIME_BREAKDOWN_BY_STAGE |
| 13 | 共有表入力漏れ | SHARED_TABLE_UPDATE_DELAY (要: 共有表更新イベントのソース化) |
| 14 | 申告撤回・リシップ処理中 | TERMINATE_PROCESSING_IN_PROGRESS |

---

## 付録C. モック表示要素の検証チェックリスト

`2026-06-11_通関ダッシュボード_フロー滞留生産性_モック.html` の全表示要素が本設計で再現可能か:

- [ ] **KPIカード7枚** (受領/申告済み/BIN間に合い率/許可件数/滞留合計/4週以上/許可済み未搬出) — `kpi_actual` から取得
- [ ] **フロー図の全件数** (受領→クレンジング→NACCS→予備/直接→許可→搬出) — `kpi_actual` 各KPI
- [ ] **フロー図の分岐** (区分1/2/3、BIN間に合い/未達、搬出/未搬出) — `kpi_actual_breakdown`
- [ ] **滞留ノード6種の色分け閾値** (黄99/橙299/赤300+) — `stage_dwell_snapshot.total_count` で判定
- [ ] **滞留各エントリの時間バケット** (24h/48h/1w/2w/4w-/4w+) — `stage_dwell_snapshot` バケット列
- [ ] **滞留ランキング** (件数降順 + バー長 + 解消条件テキスト) — `stage_dwell_snapshot` + `dwell_location_definition.exit_condition_text`
- [ ] **申告不備ヒートマップ** (4分類 × 6時間バケット + 計) — `issue_aging_snapshot`
- [ ] **書類準備中の内訳** (未処理9/発行手続き中11/PF確認中7/再申請待ち4) — `issue_aging_snapshot.fail_sub_status`
- [ ] **生産性カード4枚** (当日処理率/人時生産性/到着→許可/体制) — `kpi_actual` + `staffing_actual_daily`
- [ ] **速報原価表3行** (人件費/単価/目標差) — `kpi_actual` 原価系
- [ ] **目標差の色分け** (緑=達成/赤=未達) — `kpi_actual.actual_value` vs `kpi_target.target_value` の差
- [ ] **アラート4件** (hi/md/lo 別 + 具体メッセージ) — `alert_instance` + テンプレ展開後 title/body
- [ ] **拠点切替** (関空/関東) でデータ完全切替 — `business_location_code` での絞り込み
- [ ] **拠点ルールバー** (拠点別運用ルール文字列) — `business_location_rule` (is_displayed_on_dashboard=1)

---

## 付録D. PG/MySQL 差分メモ

| 観点 | PostgreSQL版 | MySQL版 |
|---|---|---|
| パーティショニング (`kpi_actual` / `stage_dwell_snapshot` / `issue_aging_snapshot` / `alert_instance` / `alert_notification_dispatch`) | declarative partitioning (PG12+) + `pg_partman` 自動作成 | `RANGE partition (TO_DAYS(date))` + 月次イベント or バッチで追加 |
| JSON フィールド | `JSONB` + GIN 索引 | `JSON` + 関数インデックス |
| マルチテナント分離 | RLS Policy (`tenant_id = current_setting('app.tenant_id')`) | アプリ層フィルタ + Mapper リンタ |
| 集計バッチ実装 | Spring Batch + JDBC, または PG 関数 (PL/pgSQL) | Spring Batch + JDBC, または MySQL stored procedure |
| 統計関数 | `PERCENTILE_CONT(0.5) WITHIN GROUP (...)` ネイティブ | `MEDIAN()` 無し → アプリ層計算 or window 関数 |
| `alert_instance` リアルタイム通知 | `LISTEN/NOTIFY` で軽量 | Polling or Redis Pub/Sub |

---

## 付録E. 実装時の注意

### E.1 キャパシティ試算

**`kpi_actual` の行数**:
- 73 KPI × テナント数(3) × 拠点(5) × 業務ルート(4 or NULL) × 365日 ≒ 約 **80万行/年**
- breakdown を含めても 300万行/年程度
- 月単位パーティショニングで十分カバー

**`stage_dwell_snapshot` (日次2回)**:
- 6 dwell_location × 5拠点 × 730回/年 = 約 **2万行/年** (軽量)

**`alert_instance`**:
- 100アラート/日 × 365日 = 約 **3.6万行/年** (軽量)

### E.2 Embedding/ベクトル化 (将来拡張)

PG 採用の場合、`alert_instance.body` の embedding を持って類似アラート検索が可能。設計書 §0.5.7 のパターン踏襲。

### E.3 ローカライズ

- KPI 名称・滞留場所名・ルール記述は `name_ja` / `name_en` 二言語対応 (将来は `dict` テーブル方式に変更可能)
- アラートテンプレートも locale 別に保持可能 (`alert_rule.title_template` を JSON 化)

---

## 付録F. モック表示要素 → テーブル 詳細マッピング票

### F.1 ヘッダ・拠点トグル・ルールバー

| モック要素 | モック値 (例) | テーブル | カラム/条件 | 判定 |
|---|---|---|---|---|
| ボードタイトル | "通関 統合ボード" | (定数、DB保持なし) | アプリ固定 | ✅ |
| サブタイトル日時 | "2026-06-11（水）07:30 時点" | (アプリ生成、現在時刻) | - | ✅ |
| 拠点切替トグル | 関空（関西）/ 関東（成田・新木場） | `business_location` | `WHERE is_active=1 ORDER BY display_order` | ✅ |
| 拠点ルールバー (関空) | "関空カットライン: データ夜間着→朝7時出勤…" | `business_location_rule` | `WHERE business_location_code='KIX' AND is_displayed_on_dashboard=1` | ✅ |
| 拠点ルールバー (関東) | "関東カットライン: 原則翌日処理…" | `business_location_rule` | `WHERE business_location_code='NRT' AND…` | ✅ |

### F.2 KPI カード上段 7枚

#### 各カード本体値

| # | カードラベル | モック値 (関空/関東) | kpi_code | 判定 |
|---|---|---|---|---|
| 1 | 本日処理対象（受領） | 5,200 / 7,800 | `CUSTOMS_RECEIVED_COUNT` | ✅ |
| 2 | 申告済み | 4,720 / 6,777 | `CUSTOMS_DECLARED_TOTAL_COUNT` | ✅ |
| 3 | BINに間に合った率 | 92.5% / 88.9% | `CUSTOMS_BIN_HIT_RATE` | ✅ |
| 4 | 許可件数 | 4,465 / 6,380 | `CUSTOMS_PERMITTED_COUNT` | ✅ |
| 5 | 滞留合計 | (計算値) | (kpi化推奨: `CUSTOMS_DWELL_TOTAL_COUNT`) | ⚠ 派生 |
| 6 | うち4週間以上 | (計算値) | (kpi化推奨: `CUSTOMS_DWELL_4W_OVER_TOTAL`) | ⚠ 派生 |
| 7 | 許可済み未搬出 | 120 / 290 | `CUSTOMS_PERMIT_PENDING_SHIPOUT` | ✅ |

#### 一括取得 SQL 例

```sql
-- KPI カード7枚 + サブテキスト用補助値を一発取得
SELECT kpi_code, actual_value, numerator, denominator, sample_count
FROM kpi_actual
WHERE tenant_id = :tenant
  AND business_location_code = :loc
  AND bucket_date = CURDATE()
  AND kpi_code IN (
    'CUSTOMS_RECEIVED_COUNT', 'CUSTOMS_RECEIVE_MISSING_VENDOR_COUNT',
    'CUSTOMS_DECLARED_TOTAL_COUNT', 'CUSTOMS_DECLARED_PRELIM_COUNT',
    'CUSTOMS_DECLARED_DIRECT_COUNT', 'CUSTOMS_BIN_BACKFLOW_COUNT',
    'CUSTOMS_BIN_HIT_RATE', 'CUSTOMS_BIN_HIT_COUNT', 'CUSTOMS_BIN_MISS_COUNT',
    'CUSTOMS_PERMITTED_COUNT', 'CUSTOMS_PERMIT_RATE', 'CUSTOMS_PERMIT_PENDING_SHIPOUT'
  );

-- 滞留合計・4週以上は別途集計
SELECT SUM(total_count)          AS dwell_total,
       SUM(bucket_4w_over_count) AS dwell_4w_over
FROM stage_dwell_snapshot
WHERE business_location_code = :loc
  AND snapshot_at = (
    SELECT MAX(snapshot_at) FROM stage_dwell_snapshot WHERE business_location_code = :loc
  );
```

### F.6 滞留ランキング 取得 SQL

```sql
SELECT dld.code AS dwell_kind,
       dld.name_ja,
       dld.exit_condition_text,
       d.total_count,
       d.bucket_24h_count,
       d.bucket_48h_count,
       d.bucket_1w_count,
       d.bucket_2w_count,
       d.bucket_4w_under_count,
       d.bucket_4w_over_count
FROM stage_dwell_snapshot d
JOIN dwell_location_definition dld ON dld.code = d.dwell_location_code
WHERE d.tenant_id = :tenant
  AND d.business_location_code = :loc
  AND d.snapshot_at = (
    SELECT MAX(snapshot_at) FROM stage_dwell_snapshot WHERE business_location_code = :loc
  )
ORDER BY d.total_count DESC
LIMIT 10;
```

### F.7 申告不備ヒートマップ 取得 SQL

```sql
-- 4分類 × 6時間バケット
SELECT fail_sub_category,
       SUM(bucket_24h_count)      AS b_24h,
       SUM(bucket_48h_count)      AS b_48h,
       SUM(bucket_1w_count)       AS b_1w,
       SUM(bucket_2w_count)       AS b_2w,
       SUM(bucket_4w_under_count) AS b_4w_under,
       SUM(bucket_4w_over_count)  AS b_4w_over,
       SUM(total_count)           AS total
FROM issue_aging_snapshot
WHERE tenant_id = :tenant
  AND business_location_code = :loc
  AND issue_kind = 'CUSTOMS_FAIL'
  AND snapshot_at = (
    SELECT MAX(snapshot_at)
    FROM issue_aging_snapshot
    WHERE business_location_code = :loc AND issue_kind = 'CUSTOMS_FAIL'
  )
GROUP BY fail_sub_category
ORDER BY FIELD(fail_sub_category, 'PRE_PROCESS', 'PLATFORM_CHECK', 'DOCUMENT_PREP', 'APPLY_IMPOSSIBLE');

-- 書類準備中の内訳ノート
SELECT fail_sub_status, SUM(total_count) AS cnt
FROM issue_aging_snapshot
WHERE tenant_id = :tenant
  AND business_location_code = :loc
  AND issue_kind = 'CUSTOMS_FAIL'
  AND fail_sub_category = 'DOCUMENT_PREP'
  AND snapshot_at = (SELECT MAX(snapshot_at) FROM issue_aging_snapshot WHERE business_location_code = :loc AND issue_kind = 'CUSTOMS_FAIL')
GROUP BY fail_sub_status;
```

### F.10 アラート 取得 SQL

```sql
SELECT ai.id, ai.severity, ai.title, ai.body, ai.triggered_at, ai.status, ar.kpi_code
FROM alert_instance ai
JOIN alert_rule ar ON ar.id = ai.alert_rule_id
WHERE ai.tenant_id = :tenant
  AND (ar.business_location_code = :loc OR ar.business_location_code IS NULL)
  AND ai.status = 'OPEN'
ORDER BY
  CASE ai.severity WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
  ai.triggered_at DESC
LIMIT 10;
```

### F.11 検証サマリ

| カテゴリ | 表示要素数 | ✅ | ⚠ | ❌ |
|---|---|---|---|---|
| ヘッダ・トグル・ルールバー | 6 | 6 | 0 | 0 |
| KPIカード上段7枚 (本体+サブテキスト+色) | 21 | 16 | 5 | 0 |
| 業務フロー ノード件数 | 19 | 15 | 4 | 0 |
| 業務フロー 滞留ノード | 7 | 6 | 1 | 0 |
| 業務フロー 終了系 | 1 | 1 | 0 | 0 |
| 滞留ランキング | 6 | 6 | 0 | 0 |
| 申告不備ヒートマップ | 5 | 5 | 0 | 0 |
| 生産性カード | 5 | 5 | 0 | 0 |
| 速報原価表 | 3 | 3 | 0 | 0 |
| アラート | 5 | 4 | 1 | 0 |
| **合計** | **78** | **67 (86%)** | **11 (14%)** | **0** |

**結論**:
- ❌ (取得不能) はゼロ。**汎用版 DB 設計の骨格はモック全要素をカバー可能**。
- ⚠ の 11 項目は **KPI カタログへの追加** (8項目) と **マスタ/設定の追加** (3項目) で吸収可能。設計修正は不要。
- 修正アクションは「`kpi_definition` への KPI 追加」「滞留色分け閾値の保持場所決定」「ルール起因手動アラートの `alert_rule` 追加」の 3 点に集約。

#### ⚠ KPI/カラム追加要 (8項目)

| # | 不足項目 | 追加対象 | 備考 |
|---|---|---|---|
| 1 | `CUSTOMS_DWELL_TOTAL_COUNT` (滞留合計派生kpi) | `kpi_definition` 追加 + 集計バッチで `stage_dwell_snapshot` SUM | 関空・関東両方のカード5 |
| 2 | `CUSTOMS_DWELL_4W_OVER_TOTAL` (4週以上合計派生) | 同上 | カード6 |
| 3 | `CUSTOMS_RECEIVE_MISSING_VENDOR_COUNT` (未着社数) | `kpi_definition` 追加 | カード1 サブテキスト (関空) |
| 4 | `CUSTOMS_RECEIVED_PREVDAY_COUNT` / `CUSTOMS_RECEIVED_DAY_EXCEPTION_COUNT` | 同上 | カード1 サブテキスト (関東) |
| 5 | `CUSTOMS_REVIEW_BACKFLOW_K2_COUNT` / `CUSTOMS_REVIEW_BACKFLOW_K3_COUNT` | 同上 | フロー W2→OK 復帰件数 |
| 6 | `CUSTOMS_FAIL_APPLY_IMPOSSIBLE_COUNT` | 同上 | フロー F→E1 (5件) |
| 7 | `breakdown_dimension='SHIPOUT_RULE'` | `kpi_actual_breakdown` に対応データ投入 | カード7 関東「17:30超ルール内210」 |
| 8 | `CUSTOMS_NON_AGGREGATED_DOC_PENDING_COUNT` | `kpi_definition` + `issue × business_route` 集計バッチ | アラート md (関東) |

#### ⚠ マスタ/設定追加要 (3項目)

| # | 不足項目 | 追加対象 |
|---|---|---|
| 1 | 滞留色分け閾値 (黄99/橙299/赤300+) | `sys_param` (新規追加検討) or `dwell_location_definition` にカラム追加 |
| 2 | `alert_rule` のテンプレ内変数 (`${breakdown_summary}` 等) のレンダリング仕様 | `alert_rule.body_template` 仕様書化 |
| 3 | ルール起因の手動アラート種別 (例 `CUSTOMS_DAILY_PRIORITY_RULE_UNDEFINED`) | `alert_rule` レコード追加 (自動発火条件なし、手動 INSERT 用) |

---

## 12. 次のアクション

- [ ] `kpi_definition` 73件 + 付録F §F.11.2 で発見した8件 = 計 **81件** の seed SQL 作成
- [ ] `kpi_target` 初期目標値の業務側ヒアリング (各 KPI に warning/critical threshold 設定)
- [ ] `business_location_rule` の初期データ (関空・関東・羽田・新木場の運用ルール)
- [ ] `staffing_role` × `staffing_actual_daily` の入力 UI (まず手動登録、将来は人事システム連携)
- [ ] 集計バッチ (`count_kpi_job` / `dwell_aging_snapshot_job` 等) の Spring Batch 実装
- [ ] アラート通知 dispatch worker の実装 (Slack/LINE/Email)
- [ ] モック検証チェックリスト全件の E2E テスト
- [ ] 保税・配送・集荷の現場モック作成 + 同様の KPI 精査
- [ ] §7.2 ギャップ14件のうち #13 (共有表更新遅延) のソース化 — 共有表更新イベントのキャプチャ方法
- [ ] **付録F §F.11.3 マスタ/設定追加** — 滞留色分け閾値の保持場所決定 / `alert_rule` テンプレ仕様書化 / ルール起因手動アラート種別の追加
- [ ] **付録F §F.11.2 KPI 追加 (8件)** の `kpi_definition` 登録 + 集計バッチ拡張
- [ ] **§7.3 更新頻度の業務側ヒアリング** — どの KPI を秒単位 (R) / 数秒 (N) / 時次 (H) / 日次 (D) で見たいか確定。特に配送系 (再配達件数・持ち戻り件数・配達中件数)
- [ ] **§8.5 リアルタイム widget の実装** — WebSocket 基盤 or ポーリング基盤、`kpi_definition.aggregation_window` の値域拡張 (`REALTIME` / `NEAR_REALTIME` 追加)
- [ ] **ソーステーブルへのインデックス確認** — `shipment_event(event_type, occurred_at)` `shipment(current_state, tenant_id)` `re_delivery_register(create_time)` 等、リアルタイム SELECT 耐性
