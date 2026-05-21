-- Scotland Escape — Initial Schema
-- Run this in the Supabase SQL editor (or via supabase db push)

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE team_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  email       TEXT        UNIQUE NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'team' CHECK (role IN ('admin', 'team')),
  pin         TEXT        NOT NULL CHECK (length(pin) = 4),
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE checklist_templates (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id      UUID        NOT NULL REFERENCES vans(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('pre_departure', 'handover', 'post_trip')),
  sections    JSONB       NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (van_id, type)
);

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

CREATE TABLE activity_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id    UUID        REFERENCES team_members(id),
  action            TEXT        NOT NULL,
  van_id            UUID        REFERENCES vans(id),
  metadata          JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── updated_at trigger ────────────────────────────────────────

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

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX idx_handover_records_van_id    ON handover_records (van_id);
CREATE INDEX idx_handover_records_type      ON handover_records (type);
CREATE INDEX idx_activity_log_van_id        ON activity_log (van_id);
CREATE INDEX idx_activity_log_created_at    ON activity_log (created_at DESC);
CREATE INDEX idx_checklist_templates_van_id ON checklist_templates (van_id);

-- ── Row Level Security ────────────────────────────────────────
-- The iPad runs as a single authenticated session.
-- All authenticated users get full access to all tables.

ALTER TABLE team_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE vans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE handover_records   ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log       ENABLE ROW LEVEL SECURITY;

-- team_members
CREATE POLICY "authenticated full access" ON team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- vans
CREATE POLICY "authenticated full access" ON vans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- checklist_templates
CREATE POLICY "authenticated full access" ON checklist_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- handover_records
CREATE POLICY "authenticated full access" ON handover_records
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- activity_log
CREATE POLICY "authenticated full access" ON activity_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
