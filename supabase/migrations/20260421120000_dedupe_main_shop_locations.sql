-- Fix duplicate "Main branch" rows (client re-inserted after a failed shop_locations pull).
-- Remap FKs to the oldest Main row per shop, delete extras, then enforce one Main per business.

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.inventory_items u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.sales_records u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.return_records u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.swap_records u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.credit_records u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

WITH mains AS (
  SELECT
    id,
    business_id,
    row_number() OVER (
      PARTITION BY business_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.shop_locations
  WHERE name = 'Main branch'
),
keeper AS (
  SELECT business_id, id AS keeper_id
  FROM mains
  WHERE rn = 1
),
dup AS (
  SELECT id AS dup_id, business_id
  FROM mains
  WHERE rn > 1
)
UPDATE public.repair_records u
SET location_id = k.keeper_id
FROM dup d
JOIN keeper k ON k.business_id = d.business_id
WHERE u.location_id = d.dup_id;

DELETE FROM public.shop_locations sl
WHERE sl.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      row_number() OVER (
        PARTITION BY business_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM public.shop_locations
    WHERE name = 'Main branch'
  ) x
  WHERE x.rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS shop_locations_one_main_branch_per_shop ON public.shop_locations (business_id)
WHERE
  name = 'Main branch';
