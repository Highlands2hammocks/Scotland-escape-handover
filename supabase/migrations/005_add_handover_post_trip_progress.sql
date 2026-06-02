-- Scotland Escape — In-progress handover and post-trip persistence
-- Mirrors the existing predep_progress pattern so half-done flows survive
-- refresh, tab-switch, and device hand-off. Both rows are wiped together
-- when post-trip is marked complete for that van (end of rental cycle).

CREATE TABLE IF NOT EXISTS handover_progress (
  van_id            UUID        PRIMARY KEY REFERENCES vans(id) ON DELETE CASCADE,
  step              INTEGER     NOT NULL DEFAULT 1,
  customer_name     TEXT        NOT NULL DEFAULT '',
  licence_number    TEXT        NOT NULL DEFAULT '',
  deposit_collected BOOLEAN     NOT NULL DEFAULT false,
  docs_done         JSONB       NOT NULL DEFAULT '{}',
  checked           JSONB       NOT NULL DEFAULT '{}',
  section_notes     JSONB       NOT NULL DEFAULT '{}',
  started_by        TEXT,
  started_at        TIMESTAMPTZ,
  last_updated_by   TEXT,
  last_updated_at   TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_trip_progress (
  van_id            UUID        PRIMARY KEY REFERENCES vans(id) ON DELETE CASCADE,
  phase             TEXT        NOT NULL DEFAULT 'vanSelect',
  mileage           TEXT        NOT NULL DEFAULT '',
  fuel_level        TEXT        NOT NULL DEFAULT '',
  keys_returned     BOOLEAN     NOT NULL DEFAULT false,
  customer_issues   TEXT        NOT NULL DEFAULT '',
  checked           JSONB       NOT NULL DEFAULT '{}',
  section_notes     JSONB       NOT NULL DEFAULT '{}',
  photos_map        JSONB       NOT NULL DEFAULT '{}',
  tyre_data         JSONB       NOT NULL DEFAULT '{}',
  started_by        TEXT,
  started_at        TIMESTAMPTZ,
  last_updated_by   TEXT,
  last_updated_at   TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER handover_progress_updated_at
  BEFORE UPDATE ON handover_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER post_trip_progress_updated_at
  BEFORE UPDATE ON post_trip_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE handover_progress  ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_trip_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated full access" ON handover_progress
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated full access" ON post_trip_progress
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
