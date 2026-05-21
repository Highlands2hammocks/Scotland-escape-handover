-- Scotland Escape — Add new tables (run this if 001 gave "already exists" errors)
-- This only creates the tables that didn't exist before

-- Bookings (van rentals AND equipment-only rentals)
CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type                  TEXT        NOT NULL DEFAULT 'van' CHECK (type IN ('van', 'equipment')),
  van_id                UUID        REFERENCES vans(id) ON DELETE SET NULL,
  client_name           TEXT        NOT NULL,
  guests                INTEGER     DEFAULT 1,
  start_date            DATE        NOT NULL,
  end_date              DATE        NOT NULL,
  notes                 TEXT,
  equipment_items       JSONB       NOT NULL DEFAULT '[]',
  deposit_amount        NUMERIC     NOT NULL DEFAULT 0,
  deposit_collected     BOOLEAN     NOT NULL DEFAULT false,
  pre_checks_completed  BOOLEAN     NOT NULL DEFAULT false,
  pre_checks_by         TEXT,
  pre_checks_at         TIMESTAMPTZ,
  post_checks_completed BOOLEAN     NOT NULL DEFAULT false,
  post_checks_by        TEXT,
  post_checks_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipment catalogue (sleeping bags, paddleboards, etc.)
CREATE TABLE IF NOT EXISTS equipment_catalogue (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  icon            TEXT        NOT NULL DEFAULT '📦',
  qty             INTEGER     NOT NULL DEFAULT 1,
  deposit_amount  NUMERIC     NOT NULL DEFAULT 0,
  pre_checks      JSONB       NOT NULL DEFAULT '[]',
  post_checks     JSONB       NOT NULL DEFAULT '[]',
  sort_order      INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-departure progress (saves half-done checklists)
CREATE TABLE IF NOT EXISTS predep_progress (
  van_id            UUID        PRIMARY KEY REFERENCES vans(id) ON DELETE CASCADE,
  checked           JSONB       NOT NULL DEFAULT '{}',
  notes             TEXT        NOT NULL DEFAULT '',
  tyre_data         JSONB       NOT NULL DEFAULT '{}',
  pct               INTEGER     NOT NULL DEFAULT 0,
  checked_count     INTEGER     NOT NULL DEFAULT 0,
  total_count       INTEGER     NOT NULL DEFAULT 0,
  started_by        TEXT,
  started_at        TIMESTAMPTZ,
  last_updated_by   TEXT,
  last_updated_at   TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-update timestamp for predep_progress ─────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER predep_progress_updated_at
  BEFORE UPDATE ON predep_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_bookings_van_id     ON bookings (van_id);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings (start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_type       ON bookings (type);

-- ── Security ──────────────────────────────────────────────────

ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE predep_progress     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON equipment_catalogue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON predep_progress
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
