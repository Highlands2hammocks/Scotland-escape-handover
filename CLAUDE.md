# Scotland Escape — Campervan Handover System

## Overview
A Progressive Web App (PWA) for managing campervan handovers at Scotland Escape. Used on iPads by the team at the office. Three core workflows: pre-departure clean and check, customer handover, and post-trip return check. Dashboard tracks fleet status and activity.

## Tech Stack
- **Frontend:** React (Vite), Tailwind CSS
- **Backend:** Supabase (PostgreSQL database, authentication, file storage)
- **Hosting:** Vercel
- **PWA:** Installable on iPad home screen, works with good WiFi

## Authentication
- Supabase Auth with email/password login
- Two roles: `admin` (full access, can manage team/vans/checklists) and `team` (can perform checklists and handovers, cannot edit templates or manage staff)
- Admins: Campbell, Gemma
- Team: Jorja, Michael
- Admin interface to add/remove team members and change roles

## Database Schema

### teams
- id, name, email, role (admin/team), created_at

### vans
- id, name, image_url, status (available/on_rental/in_prep/maintenance)
- mot_expiry, tax_expiry, insurance_expiry, mileage
- last_pre_departure (jsonb), last_post_trip (jsonb)

### checklist_templates
- id, van_id, type (pre_departure/handover/post_trip)
- sections (jsonb array of sections, each with items)

### handover_records
- id, van_id, team_member_id, customer_name, licence_number
- photos (jsonb), deposit_collected, checklist_data (jsonb)
- completed_at, type (pre_departure/handover/post_trip)

### activity_log
- id, team_member_id, action, van_id, metadata (jsonb), created_at

## Fleet

### Freddy — Ford Transit Custom (low roof conversion)
- Pullout bed (two drawer sections, back cushion folds flat as mattress)
- L-shape seating option (pull out front half only)
- Swivel passenger chair
- Portable gas cooker (under passenger seat, used on countertop)
- 12v fridge (power button on left, master switch by sliding door)
- No tap/water — 10L water jug and washing bucket provided
- Leisure battery, 12v USB ports, 230v hook-up (orange cable, receptor at rear under door)
- Light switches by sliding door and on countertop
- Reversing camera (activates in reverse)
- Headlights do NOT turn off automatically — must be manually switched off
- Parking sensors, Bluetooth (CarPlay may not work with newer phones)
- Storage: pots/pans under countertop, utensils in drawer (hook-latch), bedding under bed
- Table lifts out from storage area and slots into hole in cupboard
- Chairs under storage unit (access via rear doors)
- Fire extinguisher, fire blanket, spare gas canister
- Window covers, jump leads, electric hook-up cable, dustpan and brush

### Dolly — VW T5 Pop Top
- Rock and roll bed (handle under seat via left cupboard, lever slides left, bed pulls out)
- Pop top (undo straps, push up; close by pulling canvas in so nothing sticks out)
- Built-in kitchen: 2-burner hob, grill, oven (all gas)
- Gas bottle must be turned off when driving (locker accessible from back door)
- Sink with cold water only (water tank filled by team before checkout)
- Grey water dumps to floor — bucket needed under outside pipe
- 12v fridge (power button, NO master switch)
- Same electrics as Freddy (12v, 230v hook-up)
- No portable cooker
- Chairs stored in hab area (no bespoke storage)
- Spare gas bottle in back storage under chair
- Dustpan and brush under oven
- Pots/pans/crockery right of oven, cutlery beside sink

## Workflows

### 1. Dashboard
- Van cards showing: name, status, mileage, MOT/tax/insurance expiry with countdown (amber <30 days, red when expired)
- Last pre-departure check (who + when)
- Last post-trip check (who + when)
- Status dropdown to change van status
- Activity log (last 25 entries) showing who did what and when

### 2. Pre-departure Clean & Check
- Select van → work through sections → tick items → mark complete
- Progress bar showing overall completion
- Sections expand/collapse with status badges (not started/in progress/done)
- Inventory items show quantity badges (×2, ×1 etc.)
- Tyre check has input fields for PSI and tread depth per wheel (8 fields)
- Photo capture (up to 10) on Exterior, Cab, and Habitation sections for damage documentation
- Admin can: edit items, add/remove items, add/remove sections, drag to reorder items
- Optional notes field at bottom
- Completion logs who did it, when, and updates dashboard

### 3. Customer Handover
Multi-step flow:
1. **Check-in page:** Customer name, driving licence number, photo capture (licence front, licence back, proof of address ×2, signed contract), email button (pre-fills mailto to hello@scotlandescape.com with subject "Handover Docs — [Name] — [Date]"), deposit collected checkbox
2. **Van walkthrough sections:** Each section has a YouTube video embed slot at top (unlisted URLs, admin can set/change), then tick-off items confirming what was shown to customer
3. Step indicator showing progress through all sections
4. Completion sets van status to "on_rental" and logs customer name + licence

### 4. Post-trip Return Check
- Same checklist format as pre-departure
- Customer return section: keys, mileage (input field), fuel level (input field), customer-reported issues (text input)
- Exterior/cab/habitation inspection with photo capture (up to 10 each)
- Tyre checks with PSI and tread depth inputs
- Inventory checks (kitchen + equipment)
- Cleaning assessment (what needs doing)
- Every section has a "note any issue" text input at bottom
- Completion logs who did it, when, and updates dashboard

## Photo Handling
- iPad camera capture via file input with `capture="environment"`
- Photos save to camera roll
- Email button opens native mail with pre-filled subject and body
- Team member attaches photos from camera roll manually
- In future: consider Supabase Storage for automatic upload

## GDPR
- Customer documents (licence photos, proof of address) should have auto-delete after configurable retention period (e.g. 90 days post-rental)
- Build as a scheduled Supabase function

## Admin Features
- Add/remove/edit team members with role assignment
- Add/remove/edit vans with all details
- Edit all checklist items (add, remove, rename, reorder by drag)
- Add/remove checklist sections
- Set YouTube video URLs for handover walkthrough sections
- All changes persist immediately

## Key UX Requirements
- iPad-first design with large touch targets
- Dark theme (dark green palette matching Scotland Escape brand)
- PIN or quick-login for fast team member switching
- Works as PWA pinned to iPad home screen
- All data persists in Supabase
- Activity log tracks everything for dispute evidence

## Reference
- A complete working prototype exists as a React artifact (scotland-escape-handover.jsx)
- This prototype contains all checklist items, all sections, all flows
- Use it as the definitive reference for what every screen looks like and does
