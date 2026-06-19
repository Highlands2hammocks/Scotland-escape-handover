-- Scotland Escape — add Pamela as admin
-- Admin role required so she can add bookings + manage the fleet. PIN 5555.
-- Idempotent: only inserts if a team member with this name doesn't already exist.

INSERT INTO team_members (name, email, role, pin, active)
SELECT 'Pamela', 'pamela@scotlandescape.com', 'admin', '5555', true
WHERE NOT EXISTS (
  SELECT 1 FROM team_members WHERE name = 'Pamela'
);
