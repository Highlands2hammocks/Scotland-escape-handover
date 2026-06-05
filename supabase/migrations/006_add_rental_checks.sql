-- Scotland Escape — Per-rental check records
-- Stores the full pre-departure, handover and post-trip form payloads on each
-- booking, so the dashboard rental detail can show every input that was
-- captured for a specific rental. Each cycle (pre-dep → handover → post-trip)
-- is attached to the same booking; the next cycle starts fresh on the next.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rental_checks JSONB NOT NULL DEFAULT '{}';
