-- Scotland Escape — Add compliance JSONB column to bookings
-- Run in Supabase SQL Editor

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS compliance JSONB NOT NULL DEFAULT '{}';
