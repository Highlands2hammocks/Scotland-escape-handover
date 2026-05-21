-- Scotland Escape — Complete Database Schema
-- Paste this entire file into the Supabase SQL editor and click Run

-- ── Tables ────────────────────────────────────────────────────

-- Team members (Campbell, Gemma, Jorja, Michael)
CREATE TABLE team_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'team' CHECK (role IN ('admin', 'team')),
  pin         TEXT        NOT NULL CHECK (length(pin) = 4),
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vans (Freddy, Dolly, and any future vans)
CREATE TABLE vans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  image_url           TEXT,
  status              TEXT        NOT NULL DEFAULT 'available'
                                  CHECK (status IN ('available', 'on_rental', 'in_prep', 'maintenance')),
  mot_expiry          DATE,
  tax_expiry          DATE,
  insurance_expiry    DATE,
  mileage             INTEGER     NOT NULL DEFAULT 0,
  last_pre_departure  JSONB,
  last_post_trip      JSONB,
  checklist_template  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Checklist templates (the list of items for pre-departure, handover, post-trip)
CREATE TABLE checklist_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id      UUID        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('pre_departure', 'handover', 'post_trip')),
  sections    JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (van_id, type)
);

-- Bookings (van rentals AND equipment-only rentals)
CREATE TABLE bookings (
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
CREATE TABLE equipment_catalogue (
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

-- Pre-departure progress (saves half-done checklists so team can hand over)
CREATE TABLE predep_progress (
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

-- Completed handover records (audit trail)
CREATE TABLE handover_records (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id            UUID        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  team_member_id    UUID        REFERENCES team_members(id),
  type              TEXT        NOT NULL CHECK (type IN ('pre_departure', 'handover', 'post_trip')),
  customer_name     TEXT,
  licence_number    TEXT,
  photos            JSONB       NOT NULL DEFAULT '[]',
  deposit_collected BOOLEAN     DEFAULT false,
  checklist_data    JSONB       NOT NULL DEFAULT '{}',
  notes             TEXT,
  completed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity log (who did what and when — dispute evidence)
CREATE TABLE activity_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id    UUID        REFERENCES team_members(id),
  action            TEXT        NOT NULL,
  van_id            UUID        REFERENCES vans(id),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auto-update timestamps ────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vans_updated_at
  BEFORE UPDATE ON vans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER checklist_templates_updated_at
  BEFORE UPDATE ON checklist_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER predep_progress_updated_at
  BEFORE UPDATE ON predep_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Speed up common queries ───────────────────────────────────

CREATE INDEX idx_bookings_van_id            ON bookings (van_id);
CREATE INDEX idx_bookings_start_date        ON bookings (start_date);
CREATE INDEX idx_bookings_type              ON bookings (type);
CREATE INDEX idx_handover_records_van_id    ON handover_records (van_id);
CREATE INDEX idx_handover_records_type      ON handover_records (type);
CREATE INDEX idx_activity_log_van_id        ON activity_log (van_id);
CREATE INDEX idx_activity_log_created_at    ON activity_log (created_at DESC);
CREATE INDEX idx_checklist_templates_van_id ON checklist_templates (van_id);

-- ── Security (only logged-in users can read/write) ────────────

ALTER TABLE team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE vans                ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_catalogue ENABLE ROW LEVEL SECURITY;
ALTER TABLE predep_progress     ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON vans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON checklist_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON bookings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON equipment_catalogue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON predep_progress
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON handover_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON activity_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
