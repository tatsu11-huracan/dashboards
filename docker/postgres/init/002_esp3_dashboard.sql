-- ============================================================
-- ESP3.0 ダッシュボード DB 構築スクリプト
-- 対象: PostgreSQL 16
-- 文字コード: UTF-8
-- タイムゾーン: Asia/Tokyo
-- ============================================================

SET client_encoding = 'UTF8';

-- ============================================================
-- §1.2 kpi_category — KPI カテゴリ
--   他テーブルが参照するため最初に作成
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_category (
    code          VARCHAR(32)  NOT NULL,
    name_ja       VARCHAR(64)  NOT NULL,
    display_order INTEGER      NOT NULL,
    color_token   VARCHAR(16),           -- 'blue'/'green'/'amber'/'red'/'purple'
    description   VARCHAR(255),
    CONSTRAINT pk_kpi_category PRIMARY KEY (code)
);

-- ============================================================
-- §1.3 process_step — 業務番号マスタ
--   C-01〜C-10 / B-01〜B-15 / D-01〜D-09 / P-01〜P-09
-- ============================================================
CREATE TABLE IF NOT EXISTS process_step (
    code                    VARCHAR(16)  NOT NULL,
    category_code           VARCHAR(32)  NOT NULL,
    name_ja                 VARCHAR(255) NOT NULL,
    short_name              VARCHAR(64),                  -- フロー図用短縮名
    step_order              INTEGER      NOT NULL,         -- カテゴリ内ソート順
    normal_duration_minutes INTEGER,                      -- 標準処理時間(滞留判定基準)
    next_step_codes         JSONB,                        -- 通常時の遷移先 ['C-02']
    is_terminal             SMALLINT     NOT NULL DEFAULT 0, -- 1=終了系(滅却/撤回/積戻し)
    CONSTRAINT pk_process_step PRIMARY KEY (code),
    CONSTRAINT fk_process_step_category FOREIGN KEY (category_code) REFERENCES kpi_category(code)
);
CREATE INDEX IF NOT EXISTS idx_step_category ON process_step (category_code, step_order);

-- ============================================================
-- §1.1 kpi_definition — KPI 定義
--   「何を、どう測るか」の定義。kpi_target / kpi_actual から参照される
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_definition (
    code                   VARCHAR(64)  NOT NULL,
    tenant_id              VARCHAR(16),                   -- NULL=全社共通定義
    name_ja                VARCHAR(255) NOT NULL,
    name_en                VARCHAR(255),
    short_label            VARCHAR(64),                   -- ダッシュボード短縮表示用
    category_code          VARCHAR(32)  NOT NULL,
    process_step_code      VARCHAR(16),                   -- NULL=横断
    metric_type            VARCHAR(16)  NOT NULL,
    unit                   VARCHAR(16),                   -- '件' / '%' / 'hour' / '円'
    formula_description    TEXT,                          -- 人間可読の計算式
    source_query_template  TEXT,                          -- SQLテンプレ(:tenant_id :bucket_date 等)
    realtime_source_query  TEXT,                          -- §7.3 A方式用直接SELECTテンプレ
    aggregation_window     VARCHAR(16)  NOT NULL DEFAULT 'DAILY',
    default_dimensions     JSONB,                         -- ['tenant_id','agency_id','business_location_code']
    is_higher_better       SMALLINT     NOT NULL DEFAULT 1, -- 1=高い方がよい, 0=低い方がよい
    owner_dept_code        VARCHAR(32),
    is_active              SMALLINT     NOT NULL DEFAULT 1,
    display_order          INTEGER,
    description            TEXT,
    created_at             TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ,
    created_by             VARCHAR(64),
    updated_by             VARCHAR(64),
    CONSTRAINT pk_kpi_definition PRIMARY KEY (code),
    CONSTRAINT fk_kpi_def_category FOREIGN KEY (category_code) REFERENCES kpi_category(code),
    CONSTRAINT fk_kpi_def_step     FOREIGN KEY (process_step_code) REFERENCES process_step(code),
    CONSTRAINT chk_metric_type CHECK (metric_type IN (
        'COUNT','RATE','DURATION_HOURS','DURATION_MS','COST_JPY','PERCENT'
    )),
    CONSTRAINT chk_aggregation_window CHECK (aggregation_window IN (
        'REALTIME','NEAR_REALTIME','HOURLY','DAILY','MONTHLY','SNAPSHOT'
    ))
);
CREATE INDEX IF NOT EXISTS idx_kpi_def_category ON kpi_definition (category_code, display_order);
CREATE INDEX IF NOT EXISTS idx_kpi_def_step     ON kpi_definition (process_step_code);

-- ============================================================
-- §1.4 business_location — 拠点マスタ
--   KIX(関空) / NRT(成田) / HND(羽田) / SHINKIBA(新木場) / HKT(博多)
-- ============================================================
CREATE TABLE IF NOT EXISTS business_location (
    code                  VARCHAR(16) NOT NULL,
    name_ja               VARCHAR(64) NOT NULL,
    region                VARCHAR(16),                    -- KANSAI / KANTO / KYUSHU
    timezone              VARCHAR(32) DEFAULT 'Asia/Tokyo',
    is_active             SMALLINT    NOT NULL DEFAULT 1,
    display_order         INTEGER,
    parent_location_code  VARCHAR(16),                    -- 親拠点(関東圏グルーピング用)
    CONSTRAINT pk_business_location PRIMARY KEY (code),
    CONSTRAINT fk_bl_parent FOREIGN KEY (parent_location_code) REFERENCES business_location(code)
);
CREATE INDEX IF NOT EXISTS idx_loc_region ON business_location (region);

-- ============================================================
-- §1.5 business_location_rule — 拠点別運用ルール
--   モックの拠点別ルールバーを構造化保持
-- ============================================================
CREATE TABLE IF NOT EXISTS business_location_rule (
    id                        BIGSERIAL    NOT NULL,
    tenant_id                 VARCHAR(16)  NOT NULL,
    business_location_code    VARCHAR(16)  NOT NULL,
    rule_type                 VARCHAR(32)  NOT NULL,
    rule_key                  VARCHAR(64)  NOT NULL,
    rule_value                VARCHAR(255),
    rule_description          VARCHAR(500),              -- ダッシュボード表示用
    effective_from            DATE         NOT NULL,
    effective_to              DATE,
    is_displayed_on_dashboard SMALLINT     NOT NULL DEFAULT 1,
    display_order             INTEGER,
    created_at                TIMESTAMPTZ,
    updated_at                TIMESTAMPTZ,
    CONSTRAINT pk_business_location_rule  PRIMARY KEY (id),
    CONSTRAINT fk_blr_location FOREIGN KEY (business_location_code) REFERENCES business_location(code),
    CONSTRAINT chk_blr_rule_type CHECK (rule_type IN (
        'CUTOFF_TIME','DAILY_POLICY','PRIORITY_POLICY','SPECIAL_NOTE'
    )),
    CONSTRAINT uk_blr UNIQUE (tenant_id, business_location_code, rule_key, effective_from)
);
CREATE INDEX IF NOT EXISTS idx_blr_loc_display
    ON business_location_rule (business_location_code, is_displayed_on_dashboard, display_order);

-- ============================================================
-- §1.6 business_route — 処理ルートマスタ
--   集約/非集約/特定顧客ルート
-- ============================================================
CREATE TABLE IF NOT EXISTS business_route (
    code                   VARCHAR(32)  NOT NULL,
    name_ja                VARCHAR(128) NOT NULL,
    description            VARCHAR(500),
    business_location_code VARCHAR(16),
    typical_step_order     JSONB,                        -- ['HS_CHECK','CLEANSING','NACCS']
    is_active              SMALLINT     DEFAULT 1,
    CONSTRAINT pk_business_route PRIMARY KEY (code),
    CONSTRAINT fk_br_location FOREIGN KEY (business_location_code) REFERENCES business_location(code)
);

-- ============================================================
-- §1.7 responsibility_party — 責任部署マスタ
--   持ち戻り後の責任部署別件数で使用
-- ============================================================
CREATE TABLE IF NOT EXISTS responsibility_party (
    code          VARCHAR(32) NOT NULL,
    name_ja       VARCHAR(64) NOT NULL,
    is_active     SMALLINT    DEFAULT 1,
    display_order INTEGER,
    CONSTRAINT pk_responsibility_party PRIMARY KEY (code)
);

-- ============================================================
-- §1.8 aging_bucket_definition — 時間バケット定義
--   24h/48h/1週/2週/4週未満/4週以上
-- ============================================================
CREATE TABLE IF NOT EXISTS aging_bucket_definition (
    code        VARCHAR(16) NOT NULL,
    label_ja    VARCHAR(32) NOT NULL,
    min_hours   INTEGER     NOT NULL,
    max_hours   INTEGER,                -- NULL=上限なし
    sort_order  INTEGER     NOT NULL,
    color_token VARCHAR(16),            -- 'normal'/'warn'/'critical'
    is_critical SMALLINT    DEFAULT 0,  -- 1=4週以上(終了系判断対象)
    CONSTRAINT pk_aging_bucket PRIMARY KEY (code)
);

-- ============================================================
-- §1.9 dwell_location_definition — 滞留場所マスタ
--   滞留ランキング + 解消条件テキストを保持
-- ============================================================
CREATE TABLE IF NOT EXISTS dwell_location_definition (
    code                   VARCHAR(64)  NOT NULL,
    name_ja                VARCHAR(128) NOT NULL,
    category_code          VARCHAR(32)  NOT NULL,
    from_process_step_code VARCHAR(16),
    to_process_step_code   VARCHAR(16),
    exit_condition_text    VARCHAR(255),                  -- モック表示用「解消条件」
    escalation_after_hours INTEGER,                       -- これを超えるとアラート対象
    display_order          INTEGER,
    description            TEXT,
    is_active              SMALLINT     DEFAULT 1,
    CONSTRAINT pk_dwell_location       PRIMARY KEY (code),
    CONSTRAINT fk_dld_category         FOREIGN KEY (category_code)          REFERENCES kpi_category(code),
    CONSTRAINT fk_dld_from_step        FOREIGN KEY (from_process_step_code) REFERENCES process_step(code),
    CONSTRAINT fk_dld_to_step          FOREIGN KEY (to_process_step_code)   REFERENCES process_step(code)
);

-- ============================================================
-- §1.10 staffing_role — 体制ロールマスタ
--   「通関士6＋加工9」表示用
-- ============================================================
CREATE TABLE IF NOT EXISTS staffing_role (
    code          VARCHAR(32) NOT NULL,
    name_ja       VARCHAR(64) NOT NULL,
    category_code VARCHAR(32) NOT NULL,
    display_order INTEGER,
    is_active     SMALLINT    DEFAULT 1,
    CONSTRAINT pk_staffing_role    PRIMARY KEY (code),
    CONSTRAINT fk_sr_category      FOREIGN KEY (category_code) REFERENCES kpi_category(code)
);

-- ============================================================
-- §2.1 kpi_target — 目標値
--   warning_threshold / critical_threshold でアラート判定
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_target (
    id                     BIGSERIAL     NOT NULL,
    tenant_id              VARCHAR(16)   NOT NULL,
    kpi_code               VARCHAR(64)   NOT NULL,
    agency_id              BIGINT,                       -- NULL=テナント全体
    business_location_code VARCHAR(16),                  -- NULL=全拠点
    business_route_code    VARCHAR(32),                  -- NULL=ルート問わず
    effective_from         DATE          NOT NULL,
    effective_to           DATE,
    target_value           NUMERIC(20,4) NOT NULL,        -- 0.95 = 95%
    warning_threshold      NUMERIC(20,4),                -- 警告閾値
    critical_threshold     NUMERIC(20,4),                -- 危険閾値
    comparison_operator    VARCHAR(4)    NOT NULL DEFAULT '>=',
    target_basis           VARCHAR(32),
    created_at             TIMESTAMPTZ,
    updated_at             TIMESTAMPTZ,
    created_by             VARCHAR(64),
    approved_by            VARCHAR(64),
    approved_at            TIMESTAMPTZ,
    notes                  VARCHAR(500),
    CONSTRAINT pk_kpi_target PRIMARY KEY (id),
    CONSTRAINT fk_kt_kpi_def  FOREIGN KEY (kpi_code)               REFERENCES kpi_definition(code),
    CONSTRAINT fk_kt_location FOREIGN KEY (business_location_code) REFERENCES business_location(code),
    CONSTRAINT fk_kt_route    FOREIGN KEY (business_route_code)     REFERENCES business_route(code),
    CONSTRAINT chk_kt_operator CHECK (comparison_operator IN ('>=','<=','>','<','==')),
    CONSTRAINT chk_kt_basis    CHECK (target_basis IN (
        'BUSINESS_GOAL','SLA_CONTRACT','SOCIAL_NORM','HISTORICAL'
    ))
);
-- 複合 UNIQUE: nullable 列を含むため NULLS NOT DISTINCT を使用 (PG15+)
CREATE UNIQUE INDEX IF NOT EXISTS uk_kpi_target
    ON kpi_target (tenant_id, kpi_code, agency_id, business_location_code, business_route_code, effective_from)
    NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_kpi_target_kpi ON kpi_target (kpi_code, effective_from DESC);

-- ============================================================
-- §2.2 kpi_target_history — 目標変更履歴
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_target_history (
    id                  BIGSERIAL     NOT NULL,
    kpi_target_id       BIGINT        NOT NULL,
    changed_at          TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    changed_by          VARCHAR(64),
    before_target_value NUMERIC(20,4),
    after_target_value  NUMERIC(20,4),
    before_warning      NUMERIC(20,4),
    after_warning       NUMERIC(20,4),
    before_critical     NUMERIC(20,4),
    after_critical      NUMERIC(20,4),
    change_reason       VARCHAR(500),
    CONSTRAINT pk_kpi_target_history PRIMARY KEY (id),
    CONSTRAINT fk_kth_target FOREIGN KEY (kpi_target_id) REFERENCES kpi_target(id)
);
CREATE INDEX IF NOT EXISTS idx_kth_target ON kpi_target_history (kpi_target_id, changed_at DESC);

-- ============================================================
-- §3.7 kpi_aggregation_job — 集計バッチログ
--   バッチ実行結果・エラーを記録
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_aggregation_job (
    id            BIGSERIAL    NOT NULL,
    tenant_id     VARCHAR(16),
    job_name      VARCHAR(128) NOT NULL,
    job_type      VARCHAR(32),
    kpi_codes     JSONB,                               -- 対象KPIリスト(NULL=全件)
    target_date   DATE,
    window_type   VARCHAR(16),                         -- DAILY / HOURLY / SNAPSHOT
    status        VARCHAR(16)  NOT NULL DEFAULT 'RUNNING',
    started_at    TIMESTAMPTZ  NOT NULL,
    completed_at  TIMESTAMPTZ,
    duration_ms   BIGINT,
    rows_written  BIGINT       DEFAULT 0,
    error_message TEXT,
    triggered_by  VARCHAR(64),                         -- 'cron' / 'manual' / account_id
    CONSTRAINT pk_kpi_aggregation_job PRIMARY KEY (id),
    CONSTRAINT chk_kaj_type        CHECK (job_type    IN ('KPI','SNAPSHOT','EVALUATION')),
    CONSTRAINT chk_kaj_window_type CHECK (window_type IN ('DAILY','HOURLY','SNAPSHOT')),
    CONSTRAINT chk_kaj_status      CHECK (status      IN ('RUNNING','SUCCESS','FAILED','PARTIAL'))
);
CREATE INDEX IF NOT EXISTS idx_kaj_status    ON kpi_aggregation_job (status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_kaj_name_date ON kpi_aggregation_job (job_name, target_date DESC);

-- ============================================================
-- §3.1 kpi_actual — 実績値 [パーティションテーブル]
--   ダッシュボード表示の中核。日次バッチが書き込む。
--   bucket_date で月次レンジパーティション
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_actual (
    id                     BIGINT        NOT NULL GENERATED ALWAYS AS IDENTITY,
    tenant_id              VARCHAR(16)   NOT NULL,
    kpi_code               VARCHAR(64)   NOT NULL,
    agency_id              BIGINT,
    business_location_code VARCHAR(16),
    business_route_code    VARCHAR(32),
    bucket_date            DATE          NOT NULL,
    bucket_hour            SMALLINT,                    -- 0-23 JST、NULL=日次集計
    numerator              NUMERIC(20,4),               -- 分子(許可件数等)
    denominator            NUMERIC(20,4),               -- 分母(申告件数等、率KPI用)
    actual_value           NUMERIC(20,4) NOT NULL,
    sample_count           INTEGER,
    computed_at            TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    aggregation_job_id     BIGINT,
    CONSTRAINT pk_kpi_actual    PRIMARY KEY (id, bucket_date),
    CONSTRAINT chk_bucket_hour  CHECK (bucket_hour IS NULL OR (bucket_hour >= 0 AND bucket_hour <= 23))
) PARTITION BY RANGE (bucket_date);

-- 月次パーティション (2026-06 〜 2026-09 + default)
CREATE TABLE IF NOT EXISTS kpi_actual_202606 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202607 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202608 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202609 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202610 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202611 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS kpi_actual_202612 PARTITION OF kpi_actual
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS kpi_actual_default PARTITION OF kpi_actual DEFAULT;

-- UNIQUE: nullable 列は COALESCE でセンチネル値に変換
CREATE UNIQUE INDEX IF NOT EXISTS uk_kpi_actual ON kpi_actual (
    kpi_code, tenant_id, bucket_date,
    COALESCE(agency_id,              -1),
    COALESCE(business_location_code, ''),
    COALESCE(business_route_code,    ''),
    COALESCE(bucket_hour,            -1)
);
CREATE INDEX IF NOT EXISTS idx_kpi_actual_query
    ON kpi_actual (kpi_code, tenant_id, business_location_code, bucket_date DESC);

-- ============================================================
-- §3.2 kpi_actual_breakdown — 実績内訳
--   フロー分岐結果(区分1/2/3)・持ち戻り理由別等のドリルダウン用
-- ============================================================
CREATE TABLE IF NOT EXISTS kpi_actual_breakdown (
    id                  BIGSERIAL     NOT NULL,
    kpi_actual_id       BIGINT        NOT NULL,    -- kpi_actual.id (パーティションのためFK省略)
    tenant_id           VARCHAR(16)   NOT NULL,
    breakdown_dimension VARCHAR(32)   NOT NULL,
    -- KUBUN / CARRIER / DRIVER / CUSTOMER / FAIL_REASON
    -- RESPONSIBILITY_PARTY / DWELL_SUBSTATE / FAIL_SUB_CATEGORY
    breakdown_key       VARCHAR(64)   NOT NULL,   -- '1'/'2'/'3' 等
    breakdown_label     VARCHAR(255),             -- '区分1' '佐川急便' 等
    actual_value        NUMERIC(20,4),
    sub_count           INTEGER,
    CONSTRAINT pk_kpi_actual_breakdown PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_kab_actual ON kpi_actual_breakdown (kpi_actual_id, breakdown_dimension);

-- ============================================================
-- §3.3 stage_dwell_snapshot — 滞留量日次断面 [パーティション]
--   滞留ランキング・フロー滞留ノードのデータソース
--   日次2回(07:00 + 23:00)バッチで更新
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot (
    id                     BIGINT        NOT NULL GENERATED ALWAYS AS IDENTITY,
    tenant_id              VARCHAR(16)   NOT NULL,
    snapshot_at            TIMESTAMPTZ   NOT NULL,
    dwell_location_code    VARCHAR(64),
    from_step_code         VARCHAR(16),
    to_step_code           VARCHAR(16),
    agency_id              BIGINT,
    business_location_code VARCHAR(16),
    total_count            INTEGER       NOT NULL DEFAULT 0,
    bucket_24h_count       INTEGER       NOT NULL DEFAULT 0,
    bucket_48h_count       INTEGER       NOT NULL DEFAULT 0,
    bucket_1w_count        INTEGER       NOT NULL DEFAULT 0,
    bucket_2w_count        INTEGER       NOT NULL DEFAULT 0,
    bucket_4w_under_count  INTEGER       NOT NULL DEFAULT 0,
    bucket_4w_over_count   INTEGER       NOT NULL DEFAULT 0,
    avg_dwell_minutes      NUMERIC(15,2),
    p50_dwell_minutes      NUMERIC(15,2),
    p95_dwell_minutes      NUMERIC(15,2),
    p99_dwell_minutes      NUMERIC(15,2),
    oldest_entered_at      TIMESTAMPTZ,             -- 最古滞留貨物の進入時刻
    aggregation_job_id     BIGINT,
    CONSTRAINT pk_stage_dwell_snapshot PRIMARY KEY (id, snapshot_at)
) PARTITION BY RANGE (snapshot_at);

CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202606 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-06-01 00:00:00+09') TO ('2026-07-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202607 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-07-01 00:00:00+09') TO ('2026-08-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202608 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-08-01 00:00:00+09') TO ('2026-09-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202609 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-09-01 00:00:00+09') TO ('2026-10-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202610 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-10-01 00:00:00+09') TO ('2026-11-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202611 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-11-01 00:00:00+09') TO ('2026-12-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_202612 PARTITION OF stage_dwell_snapshot
    FOR VALUES FROM ('2026-12-01 00:00:00+09') TO ('2027-01-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS stage_dwell_snapshot_default PARTITION OF stage_dwell_snapshot DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_sds ON stage_dwell_snapshot (
    snapshot_at, tenant_id,
    COALESCE(dwell_location_code, ''),
    COALESCE(from_step_code,      ''),
    COALESCE(to_step_code,        ''),
    COALESCE(agency_id,           -1),
    COALESCE(business_location_code, '')
);
CREATE INDEX IF NOT EXISTS idx_sds_query
    ON stage_dwell_snapshot (tenant_id, business_location_code, snapshot_at DESC, dwell_location_code);
CREATE INDEX IF NOT EXISTS idx_sds_critical
    ON stage_dwell_snapshot (tenant_id, snapshot_at, bucket_4w_over_count);

-- ============================================================
-- §3.4 issue_aging_snapshot — 申告不備 分類×時間ヒートマップ [パーティション]
--   モック右ペイン「申告不備在庫(分類×経過時間)」のデータソース
-- ============================================================
CREATE TABLE IF NOT EXISTS issue_aging_snapshot (
    id                     BIGINT        NOT NULL GENERATED ALWAYS AS IDENTITY,
    tenant_id              VARCHAR(16)   NOT NULL,
    snapshot_at            TIMESTAMPTZ   NOT NULL,
    business_location_code VARCHAR(16),
    agency_id              BIGINT,
    issue_kind             VARCHAR(32)   NOT NULL,        -- 'CUSTOMS_FAIL' 等
    fail_sub_category      VARCHAR(32)   NOT NULL,
    fail_sub_status        VARCHAR(32),                   -- DOCUMENT_PREP 時のみ
    bucket_24h_count       INTEGER       NOT NULL DEFAULT 0,
    bucket_48h_count       INTEGER       NOT NULL DEFAULT 0,
    bucket_1w_count        INTEGER       NOT NULL DEFAULT 0,
    bucket_2w_count        INTEGER       NOT NULL DEFAULT 0,
    bucket_4w_under_count  INTEGER       NOT NULL DEFAULT 0,
    bucket_4w_over_count   INTEGER       NOT NULL DEFAULT 0,
    total_count            INTEGER       NOT NULL DEFAULT 0,
    aggregation_job_id     BIGINT,
    CONSTRAINT pk_issue_aging_snapshot PRIMARY KEY (id, snapshot_at),
    CONSTRAINT chk_ias_sub_category CHECK (fail_sub_category IN (
        'PRE_PROCESS','PLATFORM_CHECK','DOCUMENT_PREP','APPLY_IMPOSSIBLE'
    )),
    CONSTRAINT chk_ias_sub_status CHECK (fail_sub_status IS NULL OR fail_sub_status IN (
        'UNPROCESSED','ISSUING','PF_CHECK','REAPPLY_PENDING'
    ))
) PARTITION BY RANGE (snapshot_at);

CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202606 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-06-01 00:00:00+09') TO ('2026-07-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202607 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-07-01 00:00:00+09') TO ('2026-08-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202608 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-08-01 00:00:00+09') TO ('2026-09-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202609 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-09-01 00:00:00+09') TO ('2026-10-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202610 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-10-01 00:00:00+09') TO ('2026-11-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202611 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-11-01 00:00:00+09') TO ('2026-12-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_202612 PARTITION OF issue_aging_snapshot
    FOR VALUES FROM ('2026-12-01 00:00:00+09') TO ('2027-01-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS issue_aging_snapshot_default PARTITION OF issue_aging_snapshot DEFAULT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_ias ON issue_aging_snapshot (
    snapshot_at, tenant_id,
    COALESCE(business_location_code, ''),
    COALESCE(agency_id, -1),
    issue_kind, fail_sub_category,
    COALESCE(fail_sub_status, '')
);
CREATE INDEX IF NOT EXISTS idx_ias_query
    ON issue_aging_snapshot (tenant_id, business_location_code, snapshot_at DESC, issue_kind);

-- ============================================================
-- §3.6 staffing_actual_daily — 体制実績
--   「通関士6＋加工9」「人件費速報612千円」の元データ
-- ============================================================
CREATE TABLE IF NOT EXISTS staffing_actual_daily (
    id                      BIGSERIAL     NOT NULL,
    tenant_id               VARCHAR(16)   NOT NULL,
    snapshot_date           DATE          NOT NULL,
    business_location_code  VARCHAR(16)   NOT NULL,
    agency_id               BIGINT,
    role_code               VARCHAR(32)   NOT NULL,
    planned_count           INTEGER,                      -- 計画人数
    actual_count            INTEGER       NOT NULL,       -- 実績人数
    absent_count            INTEGER       DEFAULT 0,
    overtime_hours          NUMERIC(8,2)  DEFAULT 0,      -- 速報原価計算用
    cost_per_person_jpy     NUMERIC(15,2),                -- 1人あたり日次標準単価
    total_cost_forecast_jpy NUMERIC(15,2),                -- actual_count × cost_per_person
    notes                   VARCHAR(500),
    created_at              TIMESTAMPTZ,
    updated_at              TIMESTAMPTZ,
    CONSTRAINT pk_staffing_actual_daily PRIMARY KEY (id),
    CONSTRAINT fk_sad_location FOREIGN KEY (business_location_code) REFERENCES business_location(code),
    CONSTRAINT fk_sad_role     FOREIGN KEY (role_code)               REFERENCES staffing_role(code)
);
CREATE UNIQUE INDEX IF NOT EXISTS uk_sad ON staffing_actual_daily (
    tenant_id, snapshot_date, business_location_code,
    COALESCE(agency_id, -1),
    role_code
);
CREATE INDEX IF NOT EXISTS idx_sad_loc_date ON staffing_actual_daily (business_location_code, snapshot_date DESC);

-- ============================================================
-- §4.1 alert_rule — アラート発火ルール
--   KPI 閾値違反の検知ルール定義
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_rule (
    id                        BIGSERIAL    NOT NULL,
    tenant_id                 VARCHAR(16)  NOT NULL,
    code                      VARCHAR(64)  NOT NULL,
    kpi_code                  VARCHAR(64)  NOT NULL,
    agency_id                 BIGINT,
    business_location_code    VARCHAR(16),
    threshold_level           VARCHAR(16)  NOT NULL,
    evaluation_window_minutes INTEGER      NOT NULL DEFAULT 1440,  -- 5/60/1440 等
    persistence_count         INTEGER      NOT NULL DEFAULT 1,     -- N回連続違反で発火
    cooldown_minutes          INTEGER      NOT NULL DEFAULT 60,    -- 再発火抑止時間
    severity                  VARCHAR(16)  NOT NULL,
    title_template            VARCHAR(255),    -- '${kpi_name}が${actual_value}で目標${target_value}未達'
    body_template             TEXT,
    is_active                 SMALLINT     NOT NULL DEFAULT 1,
    description               TEXT,
    created_at                TIMESTAMPTZ,
    updated_at                TIMESTAMPTZ,
    created_by                VARCHAR(64),
    updated_by                VARCHAR(64),
    CONSTRAINT pk_alert_rule          PRIMARY KEY (id),
    CONSTRAINT fk_ar_kpi_def          FOREIGN KEY (kpi_code)               REFERENCES kpi_definition(code),
    CONSTRAINT fk_ar_location         FOREIGN KEY (business_location_code) REFERENCES business_location(code),
    CONSTRAINT uk_alert_rule          UNIQUE (tenant_id, code),
    CONSTRAINT chk_ar_threshold_level CHECK (threshold_level IN ('WARNING','CRITICAL')),
    CONSTRAINT chk_ar_severity        CHECK (severity        IN ('LOW','MEDIUM','HIGH','URGENT'))
);
CREATE INDEX IF NOT EXISTS idx_alert_rule_kpi ON alert_rule (kpi_code, is_active);

-- ============================================================
-- §4.2 alert_instance — 発火したアラート [パーティション]
--   OPEN/ACKNOWLEDGED/RESOLVED/SNOOZED の状態遷移
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_instance (
    id                         BIGINT        NOT NULL GENERATED ALWAYS AS IDENTITY,
    tenant_id                  VARCHAR(16)   NOT NULL,
    alert_rule_id              BIGINT        NOT NULL,
    kpi_actual_id              BIGINT,
    triggered_at               TIMESTAMPTZ   NOT NULL,
    actual_at_trigger          NUMERIC(20,4),             -- 違反時の実績値
    target_at_trigger          NUMERIC(20,4),             -- 違反時の目標値
    status                     VARCHAR(16)   NOT NULL DEFAULT 'OPEN',
    severity                   VARCHAR(16)   NOT NULL,
    title                      VARCHAR(500),
    body                       TEXT,
    template_variables_json    JSONB,
    payload_json               JSONB,
    acknowledged_at            TIMESTAMPTZ,
    acknowledged_by_account_id BIGINT,
    resolved_at                TIMESTAMPTZ,
    resolved_by_account_id     BIGINT,
    resolution_notes           TEXT,
    snoozed_until              TIMESTAMPTZ,
    auto_resolved              SMALLINT      DEFAULT 0,   -- KPI回復で自動解決
    created_at                 TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_alert_instance PRIMARY KEY (id, triggered_at),
    CONSTRAINT chk_ai_status   CHECK (status   IN ('OPEN','ACKNOWLEDGED','RESOLVED','SNOOZED')),
    CONSTRAINT chk_ai_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','URGENT'))
) PARTITION BY RANGE (triggered_at);

CREATE TABLE IF NOT EXISTS alert_instance_202606 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-06-01 00:00:00+09') TO ('2026-07-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202607 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-07-01 00:00:00+09') TO ('2026-08-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202608 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-08-01 00:00:00+09') TO ('2026-09-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202609 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-09-01 00:00:00+09') TO ('2026-10-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202610 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-10-01 00:00:00+09') TO ('2026-11-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202611 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-11-01 00:00:00+09') TO ('2026-12-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_202612 PARTITION OF alert_instance
    FOR VALUES FROM ('2026-12-01 00:00:00+09') TO ('2027-01-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_instance_default PARTITION OF alert_instance DEFAULT;

CREATE INDEX IF NOT EXISTS idx_ai_status ON alert_instance (tenant_id, status, severity, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_rule   ON alert_instance (alert_rule_id, triggered_at DESC);

-- ============================================================
-- §4.3 alert_acknowledgement — アラート確認操作履歴
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_acknowledgement (
    id                BIGSERIAL    NOT NULL,
    alert_instance_id BIGINT       NOT NULL,    -- alert_instance (パーティションのためFK省略)
    tenant_id         VARCHAR(16)  NOT NULL,
    account_id        BIGINT       NOT NULL,
    action            VARCHAR(16)  NOT NULL,
    comment           TEXT,
    performed_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_alert_ack    PRIMARY KEY (id),
    CONSTRAINT chk_ack_action  CHECK (action IN (
        'ACKNOWLEDGE','SNOOZE','RESOLVE','REOPEN','COMMENT'
    ))
);
CREATE INDEX IF NOT EXISTS idx_aa_instance ON alert_acknowledgement (alert_instance_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_aa_account  ON alert_acknowledgement (account_id, performed_at DESC);

-- ============================================================
-- §5.1 alert_channel — 通知チャネル定義
--   SLACK / LINE / EMAIL / SMS / IN_APP / WEBHOOK
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_channel (
    id                    BIGSERIAL    NOT NULL,
    tenant_id             VARCHAR(16)  NOT NULL,
    code                  VARCHAR(64)  NOT NULL,
    type                  VARCHAR(16)  NOT NULL,
    name                  VARCHAR(128) NOT NULL,
    config_kms_key        VARCHAR(255),    -- WebhookURL / アクセストークン (KMS暗号化済)
    config_json           JSONB,           -- 非機密設定 (channel_id / from_email 等)
    is_active             SMALLINT     NOT NULL DEFAULT 1,
    rate_limit_per_minute INTEGER      DEFAULT 60,
    daily_quota           INTEGER,         -- 1日上限(LINE push quota 等)
    daily_sent_count      INTEGER      DEFAULT 0,
    quota_reset_at        DATE,
    CONSTRAINT pk_alert_channel PRIMARY KEY (id),
    CONSTRAINT uk_ac            UNIQUE (tenant_id, code),
    CONSTRAINT chk_ac_type      CHECK (type IN (
        'SLACK','LINE','EMAIL','SMS','IN_APP','WEBHOOK'
    ))
);

-- ============================================================
-- §5.2 alert_routing_rule — 通知ルーティング
--   severity / kpi_code / 時間帯でマッチングし宛先へ配信
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_routing_rule (
    id                               BIGSERIAL    NOT NULL,
    tenant_id                        VARCHAR(16)  NOT NULL,
    code                             VARCHAR(64),
    -- マッチング条件 (NULL=全件対象)
    alert_rule_id                    BIGINT,
    kpi_code                         VARCHAR(64),
    severity_min                     VARCHAR(16),
    agency_id                        BIGINT,
    business_location_code           VARCHAR(16),
    time_window_start                TIME,
    time_window_end                  TIME,
    -- 配信先
    channel_id                       BIGINT       NOT NULL,
    recipient_type                   VARCHAR(16)  NOT NULL,
    recipient_value                  VARCHAR(255) NOT NULL,
    -- エスカレーション
    escalation_after_minutes         INTEGER,
    escalation_target_routing_rule_id BIGINT,
    is_active                        SMALLINT     NOT NULL DEFAULT 1,
    priority                         INTEGER      DEFAULT 100,
    description                      VARCHAR(500),
    CONSTRAINT pk_alert_routing_rule  PRIMARY KEY (id),
    CONSTRAINT fk_arr_alert_rule      FOREIGN KEY (alert_rule_id)                    REFERENCES alert_rule(id),
    CONSTRAINT fk_arr_channel         FOREIGN KEY (channel_id)                       REFERENCES alert_channel(id),
    CONSTRAINT fk_arr_location        FOREIGN KEY (business_location_code)           REFERENCES business_location(code),
    CONSTRAINT fk_arr_escalation      FOREIGN KEY (escalation_target_routing_rule_id) REFERENCES alert_routing_rule(id),
    CONSTRAINT chk_arr_severity_min   CHECK (severity_min IS NULL OR severity_min IN ('LOW','MEDIUM','HIGH','URGENT')),
    CONSTRAINT chk_arr_recipient_type CHECK (recipient_type IN (
        'ROLE','ACCOUNT','SLACK_CHANNEL','LINE_GROUP','EMAIL_LIST'
    ))
);
CREATE INDEX IF NOT EXISTS idx_arr_match
    ON alert_routing_rule (tenant_id, alert_rule_id, kpi_code, is_active);

-- ============================================================
-- §5.3 alert_notification_dispatch — 通知送信履歴 [パーティション]
--   PENDING → SENT/FAILED/RATE_LIMITED 等の送信状態管理
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_notification_dispatch (
    id                    BIGINT        NOT NULL GENERATED ALWAYS AS IDENTITY,
    alert_instance_id     BIGINT        NOT NULL,
    routing_rule_id       BIGINT        NOT NULL,
    channel_id            BIGINT        NOT NULL,
    tenant_id             VARCHAR(16)   NOT NULL,
    recipient_value       VARCHAR(255)  NOT NULL,
    message_body          TEXT,
    status                VARCHAR(16)   NOT NULL DEFAULT 'PENDING',
    attempt_count         INTEGER       NOT NULL DEFAULT 0,
    max_attempts          INTEGER       DEFAULT 3,
    last_attempt_at       TIMESTAMPTZ,
    next_retry_at         TIMESTAMPTZ,
    sent_at               TIMESTAMPTZ,
    delivered_at          TIMESTAMPTZ,              -- 配信確認 webhook
    read_at               TIMESTAMPTZ,              -- 既読
    response_payload_json JSONB,                    -- Slack msg ID / LINE request ID 等
    error_code            VARCHAR(64),
    error_message         TEXT,
    created_at            TIMESTAMPTZ   DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_alert_notification_dispatch PRIMARY KEY (id, created_at),
    CONSTRAINT chk_and_status CHECK (status IN (
        'PENDING','SENT','FAILED','SKIPPED_DND','RATE_LIMITED','QUOTA_EXCEEDED'
    ))
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202606 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-06-01 00:00:00+09') TO ('2026-07-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202607 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-07-01 00:00:00+09') TO ('2026-08-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202608 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-08-01 00:00:00+09') TO ('2026-09-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202609 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-09-01 00:00:00+09') TO ('2026-10-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202610 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-10-01 00:00:00+09') TO ('2026-11-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202611 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-11-01 00:00:00+09') TO ('2026-12-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_202612 PARTITION OF alert_notification_dispatch
    FOR VALUES FROM ('2026-12-01 00:00:00+09') TO ('2027-01-01 00:00:00+09');
CREATE TABLE IF NOT EXISTS alert_notification_dispatch_default PARTITION OF alert_notification_dispatch DEFAULT;

CREATE INDEX IF NOT EXISTS idx_and_instance
    ON alert_notification_dispatch (alert_instance_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_and_pending
    ON alert_notification_dispatch (status, next_retry_at);


-- ============================================================
-- 初期データ投入
-- ============================================================

-- -----------------------------------------------------------
-- kpi_category
-- -----------------------------------------------------------
INSERT INTO kpi_category (code, name_ja, display_order, color_token) VALUES
    ('CUSTOMS',  '通関',     1, 'blue'),
    ('BONDED',   '保税',     2, 'green'),
    ('DELIVERY', '配送',     3, 'amber'),
    ('PICKUP',   '国内集荷', 4, 'red'),
    ('E2E',      '横断/E2E', 5, 'purple')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- business_location
-- -----------------------------------------------------------
INSERT INTO business_location (code, name_ja, region, display_order) VALUES
    ('KIX',      '関西/関空', 'KANSAI', 1),
    ('NRT',      '成田',      'KANTO',  2),
    ('HND',      '羽田',      'KANTO',  3),
    ('SHINKIBA', '新木場',    'KANTO',  4),
    ('HKT',      '博多',      'KYUSHU', 5)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- aging_bucket_definition
-- -----------------------------------------------------------
INSERT INTO aging_bucket_definition (code, label_ja, min_hours, max_hours, sort_order, color_token, is_critical) VALUES
    ('BUCKET_24H',      '24h',    0,   24,  1, 'normal',   0),
    ('BUCKET_48H',      '48h',    24,  48,  2, 'normal',   0),
    ('BUCKET_1W',       '1週',    48,  168, 3, 'warn',     0),
    ('BUCKET_2W',       '2週',    168, 336, 4, 'warn',     0),
    ('BUCKET_4W_UNDER', '4週未満',336, 672, 5, 'critical', 0),
    ('BUCKET_4W_OVER',  '4週以上',672, NULL,6, 'critical', 1)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- responsibility_party
-- -----------------------------------------------------------
INSERT INTO responsibility_party (code, name_ja, display_order) VALUES
    ('CUSTOMS_TEAM',  '通関チーム',         1),
    ('BONDED_TEAM',   '保税チーム',         2),
    ('DELIVERY_DEPT', '配送部',             3),
    ('CS',            'カスタマーサポート', 4)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- process_step (通関 C-01〜C-10 + 終了系)
-- -----------------------------------------------------------
INSERT INTO process_step (code, category_code, name_ja, short_name, step_order, normal_duration_minutes, is_terminal) VALUES
    ('C-01', 'CUSTOMS', 'データ受領',   'データ受領',   1,  60,  0),
    ('C-02', 'CUSTOMS', 'HS確認',       'HS確認',        2,  120, 0),
    ('C-03', 'CUSTOMS', 'クレンジング', 'クレンジング',  3,  180, 0),
    ('C-04', 'CUSTOMS', 'NACCS準備',    'NACCS準備',     4,  60,  0),
    ('C-05', 'CUSTOMS', '予備申告',     '予備申告',      5,  30,  0),
    ('C-06', 'CUSTOMS', 'BIN突合',      'BIN突合',       6,  15,  0),
    ('C-07', 'CUSTOMS', '本申告',       '本申告',        7,  30,  0),
    ('C-08', 'CUSTOMS', '審査待ち',     '審査',          8,  480, 0),
    ('C-09', 'CUSTOMS', '許可',         '許可',          9,  0,   0),
    ('C-10', 'CUSTOMS', '搬出',         '搬出',          10, 60,  0),
    ('C-T1', 'CUSTOMS', '滅却',         '滅却',          99, 0,   1),
    ('C-T2', 'CUSTOMS', '積戻し',       '積戻し',        99, 0,   1),
    ('C-T3', 'CUSTOMS', '申告撤回',     '撤回',          99, 0,   1)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- process_step (保税 B-01〜B-08)
-- -----------------------------------------------------------
INSERT INTO process_step (code, category_code, name_ja, short_name, step_order, normal_duration_minutes, is_terminal) VALUES
    ('B-01', 'BONDED', 'OLT入庫',      'OLT入庫',  1, 60,  0),
    ('B-02', 'BONDED', 'OUT処理',      'OUT',       2, 120, 0),
    ('B-03', 'BONDED', 'BIN登録',      'BIN登録',  3, 30,  0),
    ('B-04', 'BONDED', 'HPK処理',      'HPK',       4, 60,  0),
    ('B-05', 'BONDED', 'PKG処理',      'PKG',       5, 120, 0),
    ('B-06', 'BONDED', '保留',          '保留',      6, 0,   0),
    ('B-07', 'BONDED', 'ターミナル搬入','T搬入',    7, 60,  0),
    ('B-08', 'BONDED', '搬出待ち',     '搬出待',    8, 60,  0)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- process_step (配送 D-01〜D-08)
-- -----------------------------------------------------------
INSERT INTO process_step (code, category_code, name_ja, short_name, step_order, normal_duration_minutes, is_terminal) VALUES
    ('D-01', 'DELIVERY', '配送部引渡し', '引渡し', 1, 60,  0),
    ('D-02', 'DELIVERY', '仕分け',       '仕分け', 2, 120, 0),
    ('D-03', 'DELIVERY', '積込み',       '積込み', 3, 60,  0),
    ('D-04', 'DELIVERY', '配達中',       '配達中', 4, 480, 0),
    ('D-05', 'DELIVERY', '配達完了',     '完了',   5, 0,   0),
    ('D-06', 'DELIVERY', '持ち戻り',     '持戻り', 6, 0,   0),
    ('D-07', 'DELIVERY', '再配達手配',   '再配達', 7, 60,  0),
    ('D-08', 'DELIVERY', '返品処理',     '返品',   8, 0,   1)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- process_step (集荷 P-01〜P-07)
-- -----------------------------------------------------------
INSERT INTO process_step (code, category_code, name_ja, short_name, step_order, normal_duration_minutes, is_terminal) VALUES
    ('P-01', 'PICKUP', '集荷依頼受付',   '受付',   1, 30,  0),
    ('P-02', 'PICKUP', 'ドライバー配信', '配信',   2, 60,  0),
    ('P-03', 'PICKUP', '集荷訪問',       '訪問',   3, 120, 0),
    ('P-04', 'PICKUP', '集荷完了',       '完了',   4, 0,   0),
    ('P-05', 'PICKUP', '集荷失敗',       '失敗',   5, 0,   0),
    ('P-06', 'PICKUP', '再集荷手配',     '再集荷', 6, 60,  0),
    ('P-07', 'PICKUP', '配送投入',       '投入',   7, 30,  0)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- staffing_role
-- -----------------------------------------------------------
INSERT INTO staffing_role (code, name_ja, category_code, display_order) VALUES
    ('CUSTOMS_OFFICER',  '通関士',      'CUSTOMS',  1),
    ('PROCESSING_STAFF', '加工',        'CUSTOMS',  2),
    ('BONDED_STAFF',     '保税スタッフ','BONDED',   1),
    ('DRIVER',           'ドライバー',  'DELIVERY', 1),
    ('SORTER',           '仕分け',      'DELIVERY', 2)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- business_route
-- -----------------------------------------------------------
INSERT INTO business_route (code, name_ja, is_active) VALUES
    ('AGGREGATED_NORMAL', '集約通常',   1),
    ('AGGREGATED_HEAVY',  '集約重量',   1),
    ('NON_AGGREGATED',    '非集約',     1),
    ('TOKYO_STANDARD',    '東京標準',   1)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- dwell_location_definition (通関 6種)
-- -----------------------------------------------------------
INSERT INTO dwell_location_definition
    (code, name_ja, category_code, exit_condition_text, escalation_after_hours, display_order)
VALUES
    ('CUSTOMS_PRE_CLEANSING',          'クレンジング前滞留',    'CUSTOMS', '処理能力内',             48,  1),
    ('CUSTOMS_NACCS_PREP',             'NACCS準備待ち',          'CUSTOMS', '準備完了で申告へ',        48,  2),
    ('CUSTOMS_FAIL_INVENTORY',         '申告不備在庫',            'CUSTOMS', 'うち4週間以上11・解消→再申請', 336, 3),
    ('CUSTOMS_PERMIT_PENDING_SHIPOUT', '許可済み未搬出',          'CUSTOMS', '当日集荷で解消',          24,  4),
    ('CUSTOMS_UNFILED',                '未申告在庫（BIN未達）',  'CUSTOMS', '翌日朝の優先処理',        24,  5),
    ('CUSTOMS_REVIEW_KUBUN23',         '審査対応中（区分2/3）',  'CUSTOMS', '回答/検査→許可で復帰',    672, 6)
ON CONFLICT (code) DO NOTHING;

-- dwell_location_definition (保税)
INSERT INTO dwell_location_definition
    (code, name_ja, category_code, exit_condition_text, escalation_after_hours, display_order)
VALUES
    ('BONDED_OUT_PENDING_BIN',         'OUT済み未BIN',          'BONDED', 'BIN登録で解消',          48, 1),
    ('BONDED_PERMIT_PENDING_SHIPOUT',  '保税許可済み未搬出',     'BONDED', 'ターミナル搬入で解消',   24, 2)
ON CONFLICT (code) DO NOTHING;

-- dwell_location_definition (配送)
INSERT INTO dwell_location_definition
    (code, name_ja, category_code, exit_condition_text, escalation_after_hours, display_order)
VALUES
    ('DELIVERY_HANDOVER_PENDING', '配送部未引渡し', 'DELIVERY', '配送部引渡しで解消', 24, 1)
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------
-- business_location_rule (関空 KIX)
-- -----------------------------------------------------------
INSERT INTO business_location_rule
    (tenant_id, business_location_code, rule_type, rule_key, rule_value, rule_description, effective_from, display_order)
VALUES
    ('ESP3','KIX','CUTOFF_TIME',     'TSUKAI_CUTOFF',     '15:00',  '保税側15時突合カット',                         '2026-01-01', 1),
    ('ESP3','KIX','DAILY_POLICY',    'PROCESS_DEFAULT',   '当日',   'データ夜間着→朝7時出勤、昼過ぎ着まで当日搬出', '2026-01-01', 2),
    ('ESP3','KIX','PRIORITY_POLICY', 'DEFAULT_PRIORITY',  'BIN→PKG','進捗優先順位',                                 '2026-01-01', 3)
ON CONFLICT (tenant_id, business_location_code, rule_key, effective_from) DO NOTHING;

-- business_location_rule (成田 NRT)
INSERT INTO business_location_rule
    (tenant_id, business_location_code, rule_type, rule_key, rule_value, rule_description, effective_from, display_order)
VALUES
    ('ESP3','NRT','CUTOFF_TIME',  'PERMIT_RECEIVE_CUTOFF_PM','17:30','許可17:30以降→翌日搬出ルール', '2026-01-01', 1),
    ('ESP3','NRT','DAILY_POLICY', 'PROCESS_DEFAULT',         '翌日', '原則翌日処理',                  '2026-01-01', 2)
ON CONFLICT (tenant_id, business_location_code, rule_key, effective_from) DO NOTHING;

-- -----------------------------------------------------------
-- kpi_definition (通関 32種)
-- -----------------------------------------------------------
INSERT INTO kpi_definition
    (code, name_ja, category_code, process_step_code, metric_type, unit, aggregation_window, is_higher_better, display_order)
VALUES
    -- 通過件数系 (10)
    ('CUSTOMS_RECEIVED_COUNT',           'データ受領件数',         'CUSTOMS','C-01','COUNT','件','DAILY',   1, 1),
    ('CUSTOMS_CLEANSED_COUNT',           'クレンジング完了件数',    'CUSTOMS','C-03','COUNT','件','DAILY',   1, 2),
    ('CUSTOMS_NACCS_PREPARED_COUNT',     'NACCS準備完了件数',       'CUSTOMS','C-04','COUNT','件','DAILY',   1, 3),
    ('CUSTOMS_DECLARED_PRELIM_COUNT',    '予備申告件数',             'CUSTOMS','C-05','COUNT','件','DAILY',   1, 4),
    ('CUSTOMS_DECLARED_DIRECT_COUNT',    '本申告直接件数',           'CUSTOMS','C-07','COUNT','件','DAILY',   1, 5),
    ('CUSTOMS_DECLARED_TOTAL_COUNT',     '申告済み合計',             'CUSTOMS','C-07','COUNT','件','DAILY',   1, 6),
    ('CUSTOMS_PERMITTED_COUNT',          '許可件数',                 'CUSTOMS','C-09','COUNT','件','DAILY',   1, 7),
    ('CUSTOMS_SHIPPED_OUT_COUNT',        '搬出済件数',               'CUSTOMS','C-10','COUNT','件','DAILY',   1, 8),
    ('CUSTOMS_RESUBMITTED_COUNT',        '再申請件数',               'CUSTOMS',NULL,  'COUNT','件','DAILY',   1, 9),
    ('CUSTOMS_TERMINATED_COUNT',         '終了系件数(滅却/積戻し/撤回)','CUSTOMS',NULL,'COUNT','件','DAILY', 0, 10),
    -- 分岐結果系 (7)
    ('CUSTOMS_KUBUN_1_COUNT',            '税関区分1件数',            'CUSTOMS','C-08','COUNT','件','DAILY',   1, 11),
    ('CUSTOMS_KUBUN_2_COUNT',            '税関区分2件数',            'CUSTOMS','C-08','COUNT','件','DAILY',   0, 12),
    ('CUSTOMS_KUBUN_3_COUNT',            '税関区分3件数',            'CUSTOMS','C-08','COUNT','件','DAILY',   0, 13),
    ('CUSTOMS_BIN_HIT_COUNT',            'BIN間に合い件数',          'CUSTOMS','C-06','COUNT','件','DAILY',   1, 14),
    ('CUSTOMS_BIN_MISS_COUNT',           'BIN未達件数',              'CUSTOMS','C-06','COUNT','件','DAILY',   0, 15),
    ('CUSTOMS_BIN_BACKFLOW_COUNT',       'BIN未達当日復帰件数',      'CUSTOMS',NULL,  'COUNT','件','DAILY',   1, 16),
    ('CUSTOMS_REVIEW_BACKFLOW_COUNT',    '区分2/3からの復帰件数',    'CUSTOMS',NULL,  'COUNT','件','DAILY',   1, 17),
    -- 率指標 (4)
    ('CUSTOMS_BIN_HIT_RATE',             'BIN間に合い率',            'CUSTOMS','C-06','RATE', '%', 'DAILY',   1, 18),
    ('CUSTOMS_PERMIT_RATE',              '許可率',                   'CUSTOMS','C-09','RATE', '%', 'DAILY',   1, 19),
    ('CUSTOMS_DAILY_PROCESSING_RATE',    '当日処理率',               'CUSTOMS',NULL,  'RATE', '%', 'DAILY',   1, 20),
    ('CUSTOMS_NEXT_DAY_PROCESSING_RATE', '翌日内処理率',             'CUSTOMS',NULL,  'RATE', '%', 'DAILY',   1, 21),
    -- 滞留量 (6)
    ('CUSTOMS_PRE_CLEANSING_BACKLOG',    'クレンジング前滞留',       'CUSTOMS','C-03','COUNT','件','SNAPSHOT',0, 22),
    ('CUSTOMS_NACCS_PREP_PENDING',       'NACCS準備待ち',            'CUSTOMS','C-04','COUNT','件','SNAPSHOT',0, 23),
    ('CUSTOMS_FAIL_INVENTORY_COUNT',     '申告不備在庫',             'CUSTOMS',NULL,  'COUNT','件','SNAPSHOT',0, 24),
    ('CUSTOMS_REVIEW_PENDING_COUNT',     '審査対応中(区分2/3)',      'CUSTOMS','C-08','COUNT','件','SNAPSHOT',0, 25),
    ('CUSTOMS_UNFILED_INVENTORY_COUNT',  '未申告在庫(BIN未達)',      'CUSTOMS',NULL,  'COUNT','件','SNAPSHOT',0, 26),
    ('CUSTOMS_PERMIT_PENDING_SHIPOUT',   '許可済み未搬出',           'CUSTOMS','C-09','COUNT','件','SNAPSHOT',0, 27),
    -- 生産性・原価 (5)
    ('CUSTOMS_RECEIVE_TO_PERMIT_HOURS',        '到着→許可時間',      'CUSTOMS',NULL,'DURATION_HOURS','hour','DAILY',0, 28),
    ('CUSTOMS_PRODUCTIVITY_PER_PERSON_HOUR',   '人時生産性',         'CUSTOMS',NULL,'RATE',          '件/人時','DAILY',1, 29),
    ('CUSTOMS_PERSONNEL_COST_FORECAST',        '人件費速報',         'CUSTOMS',NULL,'COST_JPY',      '千円','DAILY',0, 30),
    ('CUSTOMS_UNIT_COST_PER_PERMIT',           '許可1件単価',        'CUSTOMS',NULL,'COST_JPY',      '円','DAILY',0, 31),
    ('CUSTOMS_UNIT_COST_VS_TARGET_DIFF',       '目標単価差',         'CUSTOMS',NULL,'COST_JPY',      '円','DAILY',0, 32)
ON CONFLICT (code) DO NOTHING;

-- kpi_definition (保税 12種)
INSERT INTO kpi_definition
    (code, name_ja, category_code, metric_type, unit, aggregation_window, is_higher_better, display_order)
VALUES
    ('BONDED_PKG_PENDING_OUT',          'PKG済み未OUT',         'BONDED','COUNT',          '件',   'SNAPSHOT',0, 1),
    ('BONDED_OUT_PENDING_BIN',          'OUT済み未BIN',          'BONDED','COUNT',          '件',   'SNAPSHOT',0, 2),
    ('BONDED_BIN_PENDING_HPK',          'BIN済み未HPK',          'BONDED','COUNT',          '件',   'SNAPSHOT',0, 3),
    ('BONDED_HPK_ERROR_COUNT',          'HPKエラー件数',         'BONDED','COUNT',          '件',   'DAILY',   0, 4),
    ('BONDED_PERMIT_PENDING_SHIPOUT',   '保税許可済み未搬出',     'BONDED','COUNT',          '件',   'SNAPSHOT',0, 5),
    ('BONDED_HOLD_ZONE_COUNT',          '保留件数',               'BONDED','COUNT',          '件',   'SNAPSHOT',0, 6),
    ('BONDED_HOLD_AGING_OVER_7D',       '保留7日超件数',          'BONDED','COUNT',          '件',   'SNAPSHOT',0, 7),
    ('BONDED_PICKUP_PENDING_NEXT_DAY',  '翌日集荷待ち',           'BONDED','COUNT',          '件',   'SNAPSHOT',0, 8),
    ('BONDED_TERMINAL_24H_OVER_COUNT',  'ターミナル24h超過',      'BONDED','COUNT',          '件',   'SNAPSHOT',0, 9),
    ('BONDED_STORAGE_FEE_UNBILLED',     '未請求保管料',           'BONDED','COST_JPY',       '円',   'DAILY',   0, 10),
    ('BONDED_OLT_TO_OUT_DURATION',      'OLT→OUTリードタイム',   'BONDED','DURATION_HOURS', 'hour', 'DAILY',   0, 11),
    ('BONDED_PLAN_VS_ACTUAL_VOLUME',    '処理能力予実',           'BONDED','RATE',           '%',    'DAILY',   1, 12)
ON CONFLICT (code) DO NOTHING;

-- kpi_definition (配送 14種)
INSERT INTO kpi_definition
    (code, name_ja, category_code, metric_type, unit, aggregation_window, is_higher_better, display_order)
VALUES
    ('DELIVERY_HANDOVER_PENDING',          '配送部未引渡',         'DELIVERY','COUNT',          '件',   'REALTIME',      0, 1),
    ('DELIVERY_SORTING_IN_PROGRESS',       '仕分け中件数',         'DELIVERY','COUNT',          '件',   'NEAR_REALTIME', 0, 2),
    ('DELIVERY_CHUTE_NO_DATA_RATE',        'Chute NO_DATA率',      'DELIVERY','RATE',           '%',    'NEAR_REALTIME', 0, 3),
    ('DELIVERY_LOADED_COUNT',              '積込済件数',           'DELIVERY','COUNT',          '件',   'HOURLY',        1, 4),
    ('DELIVERY_COMPLETE_RATE_24H',         '24h完了率',            'DELIVERY','RATE',           '%',    'DAILY',         1, 5),
    ('DELIVERY_RETURN_RATE',               '持ち戻り率',           'DELIVERY','RATE',           '%',    'DAILY',         0, 6),
    ('DELIVERY_RETURN_REASON_BREAKDOWN',   '持ち戻り理由別',       'DELIVERY','COUNT',          '件',   'DAILY',         0, 7),
    ('DELIVERY_ADDRESS_DEFECT_COUNT',      '住所不備件数',         'DELIVERY','COUNT',          '件',   'DAILY',         0, 8),
    ('DELIVERY_DAMAGE_COUNT',              '破損件数',             'DELIVERY','COUNT',          '件',   'DAILY',         0, 9),
    ('DELIVERY_RECOVERABLE_RATE',          '復旧率',               'DELIVERY','RATE',           '%',    'DAILY',         1, 10),
    ('DELIVERY_REDELIVERY_SLA_BREACH',     '再配達SLA超過',        'DELIVERY','COUNT',          '件',   'DAILY',         0, 11),
    ('DELIVERY_VEHICLE_UTILIZATION',       '車両稼働率',           'DELIVERY','RATE',           '%',    'DAILY',         1, 12),
    ('DELIVERY_IRREGULAR_NOTIFY_DELAY',    'イレギュラー通知遅延', 'DELIVERY','DURATION_HOURS', 'hour', 'DAILY',         0, 13),
    ('DELIVERY_RESPONSIBILITY_PENDING',    '責任部署別未解決',     'DELIVERY','COUNT',          '件',   'DAILY',         0, 14)
ON CONFLICT (code) DO NOTHING;

-- kpi_definition (集荷 10種)
INSERT INTO kpi_definition
    (code, name_ja, category_code, metric_type, unit, aggregation_window, is_higher_better, display_order)
VALUES
    ('PICKUP_REQUEST_COUNT_DAILY',      '集荷依頼件数',         'PICKUP','COUNT',          '件',   'DAILY',    1, 1),
    ('PICKUP_12HCUT_TODAY_RATIO',       '12時カット当日比率',   'PICKUP','RATE',           '%',    'DAILY',    1, 2),
    ('PICKUP_CONTACT_PENDING_COUNT',    '連絡未了件数',         'PICKUP','COUNT',          '件',   'SNAPSHOT', 0, 3),
    ('PICKUP_DRIVER_ASSIGNED_RATE',     'アプリ配信済率',       'PICKUP','RATE',           '%',    'DAILY',    1, 4),
    ('PICKUP_SUCCESS_RATE',             '集荷成功率',           'PICKUP','RATE',           '%',    'REALTIME', 1, 5),
    ('PICKUP_FAILURE_REASON_BREAKDOWN', '失敗理由別件数',       'PICKUP','COUNT',          '件',   'DAILY',    0, 6),
    ('PICKUP_RESCHEDULE_RATE',          '再集荷率',             'PICKUP','RATE',           '%',    'DAILY',    0, 7),
    ('PICKUP_TO_SORTING_LEAD_TIME',     '集荷→配送投入LT',     'PICKUP','DURATION_HOURS', 'hour', 'DAILY',    0, 8),
    ('PICKUP_API_RETURN_FAILURE_RATE',  'PF API返送失敗率',     'PICKUP','RATE',           '%',    'DAILY',    0, 9),
    ('PICKUP_TODAY_PREDICTED_COUNT',    '集荷予定数',           'PICKUP','COUNT',          '件',   'DAILY',    1, 10)
ON CONFLICT (code) DO NOTHING;

-- kpi_definition (E2E/横断 5種)
INSERT INTO kpi_definition
    (code, name_ja, category_code, metric_type, unit, aggregation_window, is_higher_better, display_order)
VALUES
    ('E2E_DATA_RECEIPT_TO_DELIVERY_LT',   '依頼〜配達完了E2E',       'E2E','DURATION_HOURS','hour','DAILY',   0, 1),
    ('E2E_LEAD_TIME_BREAKDOWN_BY_STAGE',  '工程別時間分解',           'E2E','DURATION_HOURS','hour','DAILY',   0, 2),
    ('SHARED_TABLE_UPDATE_DELAY',         '共有表更新遅延',           'E2E','DURATION_HOURS','hour','DAILY',   0, 3),
    ('TERMINATE_PROCESSING_IN_PROGRESS',  '申告撤回・リシップ処理中', 'E2E','COUNT',         '件', 'SNAPSHOT', 0, 4),
    ('INSPECTION_SCHEDULE_VS_RESULT',     '検査スケジュール・結果',   'E2E','RATE',          '%',  'DAILY',    1, 5)
ON CONFLICT (code) DO NOTHING;
