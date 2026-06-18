-- 開発用: 通関運用API向けスナップショット初期データ
-- 既存データがある場合は投入しない

WITH target_snapshot AS (
  SELECT TIMESTAMPTZ '2026-06-18 09:00:00+09' AS snapshot_at
), empty_stage AS (
  SELECT COUNT(*) = 0 AS is_empty FROM stage_dwell_snapshot
), empty_issue AS (
  SELECT COUNT(*) = 0 AS is_empty FROM issue_aging_snapshot
)
INSERT INTO stage_dwell_snapshot (
  tenant_id,
  snapshot_at,
  dwell_location_code,
  business_location_code,
  total_count,
  bucket_24h_count,
  bucket_48h_count,
  bucket_1w_count,
  bucket_2w_count,
  bucket_4w_under_count,
  bucket_4w_over_count,
  avg_dwell_minutes,
  p50_dwell_minutes,
  p95_dwell_minutes,
  p99_dwell_minutes
)
SELECT
  'ESP',
  t.snapshot_at,
  v.dwell_location_code,
  v.business_location_code,
  v.total_count,
  v.bucket_24h_count,
  v.bucket_48h_count,
  v.bucket_1w_count,
  v.bucket_2w_count,
  v.bucket_4w_under_count,
  v.bucket_4w_over_count,
  v.avg_dwell_minutes,
  v.p50_dwell_minutes,
  v.p95_dwell_minutes,
  v.p99_dwell_minutes
FROM target_snapshot t
CROSS JOIN empty_stage e
CROSS JOIN (
  VALUES
    ('CUSTOMS_UNFILED',                'KIX', 26, 10, 8, 5, 2, 1, 0, 178::numeric, 120::numeric, 410::numeric, 680::numeric),
    ('CUSTOMS_REVIEW_KUBUN23',         'KIX', 34, 14, 10, 6, 3, 1, 0, 152::numeric, 103::numeric, 360::numeric, 590::numeric),
    ('CUSTOMS_FAIL_INVENTORY',         'NRT', 19, 8, 5, 4, 1, 1, 0, 204::numeric, 150::numeric, 460::numeric, 700::numeric),
    ('CUSTOMS_PRE_CLEANSING',          'KIX', 17, 9, 4, 2, 1, 1, 0, 138::numeric, 90::numeric, 330::numeric, 510::numeric),
    ('CUSTOMS_NACCS_PREP',             'NRT', 12, 6, 3, 2, 1, 0, 0, 92::numeric, 70::numeric, 210::numeric, 340::numeric),
    ('CUSTOMS_PERMIT_PENDING_SHIPOUT', 'NRT', 9, 4, 2, 2, 1, 0, 0, 126::numeric, 80::numeric, 240::numeric, 390::numeric)
) AS v(
  dwell_location_code,
  business_location_code,
  total_count,
  bucket_24h_count,
  bucket_48h_count,
  bucket_1w_count,
  bucket_2w_count,
  bucket_4w_under_count,
  bucket_4w_over_count,
  avg_dwell_minutes,
  p50_dwell_minutes,
  p95_dwell_minutes,
  p99_dwell_minutes
)
WHERE e.is_empty;

INSERT INTO issue_aging_snapshot (
  tenant_id,
  snapshot_at,
  business_location_code,
  issue_kind,
  fail_sub_category,
  fail_sub_status,
  bucket_24h_count,
  bucket_48h_count,
  bucket_1w_count,
  bucket_2w_count,
  bucket_4w_under_count,
  bucket_4w_over_count,
  total_count
)
WITH target_snapshot AS (
  SELECT TIMESTAMPTZ '2026-06-18 09:00:00+09' AS snapshot_at
), empty_issue AS (
  SELECT COUNT(*) = 0 AS is_empty FROM issue_aging_snapshot
)
SELECT
  'ESP',
  t.snapshot_at,
  v.business_location_code,
  'CUSTOMS_FAIL',
  v.fail_sub_category,
  v.fail_sub_status,
  v.bucket_24h_count,
  v.bucket_48h_count,
  v.bucket_1w_count,
  v.bucket_2w_count,
  v.bucket_4w_under_count,
  v.bucket_4w_over_count,
  v.total_count
FROM target_snapshot t
CROSS JOIN empty_issue e
CROSS JOIN (
  VALUES
    ('KIX', 'PRE_PROCESS',    NULL,             12, 7, 4, 2, 1, 0, 26),
    ('NRT', 'PLATFORM_CHECK', NULL,             8, 5, 3, 1, 1, 0, 18),
    ('KIX', 'DOCUMENT_PREP',  'UNPROCESSED',    9, 5, 2, 1, 0, 0, 17),
    ('NRT', 'APPLY_IMPOSSIBLE', NULL,           3, 2, 2, 1, 1, 0, 9)
) AS v(
  business_location_code,
  fail_sub_category,
  fail_sub_status,
  bucket_24h_count,
  bucket_48h_count,
  bucket_1w_count,
  bucket_2w_count,
  bucket_4w_under_count,
  bucket_4w_over_count,
  total_count
)
WHERE e.is_empty;
