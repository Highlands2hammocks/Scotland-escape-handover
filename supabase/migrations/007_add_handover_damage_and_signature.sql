-- Scotland Escape — damage report + customer signature on handover
-- damage_marks: array of { view, x, y } where x/y are 0..1 normalized
--   coordinates relative to the SVG van diagram for that view.
-- signature_data_url: PNG data URL captured from the on-screen signature pad.

ALTER TABLE handover_progress
  ADD COLUMN IF NOT EXISTS damage_marks        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS signature_data_url  TEXT  NOT NULL DEFAULT '';
