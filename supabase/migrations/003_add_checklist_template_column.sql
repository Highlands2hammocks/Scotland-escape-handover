-- Scotland Escape — Ensure vans.checklist_template exists
-- Older deployments seeded from 001_initial_schema.sql are missing this column,
-- which causes every status update upsert to fail silently.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS is a no-op when the column already exists.

ALTER TABLE vans ADD COLUMN IF NOT EXISTS checklist_template TEXT;

-- Backfill the two seed vans so the app can still find their checklist templates.
UPDATE vans SET checklist_template = 'freddy' WHERE name = 'Freddy' AND checklist_template IS NULL;
UPDATE vans SET checklist_template = 'dolly'  WHERE name = 'Dolly'  AND checklist_template IS NULL;
