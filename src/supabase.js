import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Auth: auto sign-in for the iPad session ───────────────────

export async function ensureSignedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error("Supabase sign-in failed: " + error.message);
}

// ── Field mappers: DB rows → App objects ──────────────────────

const fromDbVan = r => ({
  id: r.id,
  name: r.name,
  image: r.image_url || "🚐",
  status: r.status || "available",
  motExpiry: r.mot_expiry || null,
  taxExpiry: r.tax_expiry || null,
  insuranceExpiry: r.insurance_expiry || null,
  mileage: r.mileage || 0,
  lastPreDeparture: r.last_pre_departure || null,
  lastPostTrip: r.last_post_trip || null,
  checklistTemplate: r.checklist_template || null,
});

const toDbVan = v => ({
  id: v.id,
  name: v.name,
  image_url: v.image || null,
  status: v.status || "available",
  mot_expiry: v.motExpiry || null,
  tax_expiry: v.taxExpiry || null,
  insurance_expiry: v.insuranceExpiry || null,
  mileage: v.mileage || 0,
  last_pre_departure: v.lastPreDeparture || null,
  last_post_trip: v.lastPostTrip || null,
  checklist_template: v.checklistTemplate || null,
});

const fromDbMember = r => ({
  id: r.id,
  name: r.name,
  email: r.email || "",
  role: r.role,
  pin: r.pin,
  active: r.active !== false,
});

const toDbMember = m => ({
  id: m.id,
  name: m.name,
  email: m.email || `${m.name.toLowerCase().replace(/\s+/g, ".")}@scotlandescape.com`,
  role: m.role,
  pin: m.pin,
  active: m.active !== false,
});

const fromDbBooking = r => ({
  id: r.id,
  type: r.type,
  vanId: r.van_id || null,
  clientName: r.client_name,
  guests: r.guests || 1,
  startDate: r.start_date,
  endDate: r.end_date,
  notes: r.notes || "",
  equipmentItems: r.equipment_items || [],
  depositAmount: r.deposit_amount || 0,
  depositCollected: r.deposit_collected || false,
  preChecksCompleted: r.pre_checks_completed || false,
  preChecksBy: r.pre_checks_by || null,
  preChecksAt: r.pre_checks_at || null,
  postChecksCompleted: r.post_checks_completed || false,
  postChecksBy: r.post_checks_by || null,
  postChecksAt: r.post_checks_at || null,
  compliance: r.compliance || {},
});

const toDbBooking = b => ({
  id: b.id,
  type: b.type || "van",
  van_id: b.vanId || null,
  client_name: b.clientName,
  guests: b.guests || 1,
  start_date: b.startDate,
  end_date: b.endDate,
  notes: b.notes || null,
  equipment_items: b.equipmentItems || [],
  deposit_amount: b.depositAmount || 0,
  deposit_collected: b.depositCollected || false,
  pre_checks_completed: b.preChecksCompleted || false,
  pre_checks_by: b.preChecksBy || null,
  pre_checks_at: b.preChecksAt || null,
  post_checks_completed: b.postChecksCompleted || false,
  post_checks_by: b.postChecksBy || null,
  post_checks_at: b.postChecksAt || null,
  compliance: b.compliance || {},
});

const fromDbEquipment = r => ({
  id: r.id,
  name: r.name,
  icon: r.icon || "📦",
  qty: r.qty || 1,
  depositAmount: r.deposit_amount || 0,
  preChecks: r.pre_checks || [],
  postChecks: r.post_checks || [],
  sortOrder: r.sort_order || 0,
});

const toDbEquipment = e => ({
  id: e.id,
  name: e.name,
  icon: e.icon || "📦",
  qty: e.qty || 1,
  deposit_amount: e.depositAmount || 0,
  pre_checks: e.preChecks || [],
  post_checks: e.postChecks || [],
  sort_order: e.sortOrder || 0,
});

const fromDbLog = r => ({
  id: r.id,
  who: r.metadata?.who || "",
  action: r.action,
  van: r.metadata?.van || "",
  date: r.created_at,
});

const fromDbPredep = r => ({
  checked: r.checked || {},
  notes: r.notes || "",
  tyreData: r.tyre_data || {},
  pct: r.pct || 0,
  checkedCount: r.checked_count || 0,
  totalCount: r.total_count || 0,
  startedBy: r.started_by || null,
  startedAt: r.started_at || null,
  lastUpdatedBy: r.last_updated_by || null,
  lastUpdatedAt: r.last_updated_at || null,
});

// ── First-run seed data ───────────────────────────────────────

const VAN_SEEDS = [
  { name: "Freddy", image_url: "🚐", status: "available", mot_expiry: "2026-09-15", tax_expiry: "2026-11-01", insurance_expiry: "2026-08-20", mileage: 42350, checklist_template: "freddy" },
  { name: "Dolly",  image_url: "🚐", status: "available", mot_expiry: "2026-07-22", tax_expiry: "2026-10-15", insurance_expiry: "2026-08-20", mileage: 38120, checklist_template: "dolly"  },
];

const EQUIPMENT_SEEDS = [
  { name: "Sleeping Bag", icon: "🛏️", qty: 2, deposit_amount: 20, sort_order: 1,
    pre_checks: [{ id: "pre_sb1", label: "Machine wash and tumble dry on low heat" }, { id: "pre_sb2", label: "Check zip runs full length smoothly" }, { id: "pre_sb3", label: "Check for holes, tears or damage" }],
    post_checks: [{ id: "post_sb1", label: "Machine wash and tumble dry on return" }, { id: "post_sb2", label: "Check zip condition — note any faults" }, { id: "post_sb3", label: "Check for stains, holes or new damage" }] },
  { name: "Paddleboard + Paddle + Leash", icon: "🏄", qty: 1, deposit_amount: 50, sort_order: 2,
    pre_checks: [{ id: "pre_pb1", label: "Check board for cracks or dings — photograph any existing damage" }, { id: "pre_pb2", label: "Check leash clip and cord for wear" }, { id: "pre_pb3", label: "Check paddle is assembled correctly and secure" }, { id: "pre_pb4", label: "Rinse board and dry before issue" }],
    post_checks: [{ id: "post_pb1", label: "Rinse board, paddle and leash with fresh water" }, { id: "post_pb2", label: "Check for new cracks, dings or damage" }, { id: "post_pb3", label: "Check leash and clip condition" }, { id: "post_pb4", label: "Dry fully before storing" }] },
  { name: "Wetsuit", icon: "🌊", qty: 2, deposit_amount: 30, sort_order: 3,
    pre_checks: [{ id: "pre_ws1", label: "Rinse with fresh water and hang dry before issue" }, { id: "pre_ws2", label: "Check zip works smoothly full length" }, { id: "pre_ws3", label: "Check for tears, holes or panel separation" }],
    post_checks: [{ id: "post_ws1", label: "Rinse with fresh water on return" }, { id: "post_ws2", label: "Check zip condition — note any damage" }, { id: "post_ws3", label: "Check for new tears or damage" }, { id: "post_ws4", label: "Hang dry — do NOT tumble dry" }] },
  { name: "Camping Cooking Set", icon: "🍳", qty: 1, deposit_amount: 15, sort_order: 4,
    pre_checks: [{ id: "pre_ck1", label: "Wash all pots, pans and lids" }, { id: "pre_ck2", label: "Check all pieces are present" }, { id: "pre_ck3", label: "Check handles are secure and not loose" }],
    post_checks: [{ id: "post_ck1", label: "Wash all pieces on return" }, { id: "post_ck2", label: "Check all pieces returned" }, { id: "post_ck3", label: "Check for damage — burnt, cracked or bent" }] },
  { name: "Extra Camping Chairs (×2)", icon: "🪑", qty: 1, deposit_amount: 10, sort_order: 5,
    pre_checks: [{ id: "pre_ch1", label: "Check frames are straight and undamaged" }, { id: "pre_ch2", label: "Check fabric for tears or staining" }, { id: "pre_ch3", label: "Test fold and unfold mechanism" }],
    post_checks: [{ id: "post_ch1", label: "Check frames on return — bent or cracked" }, { id: "post_ch2", label: "Check fabric for new tears or stains" }, { id: "post_ch3", label: "Clean and dry before storing" }] },
];

// ── DB operations ─────────────────────────────────────────────

export const db = {

  // ── Team members ──
  async getTeam() {
    const { data, error } = await supabase.from("team_members").select("*").order("name");
    if (error) { console.error("getTeam:", error.message); return []; }
    return (data || []).map(fromDbMember);
  },
  async saveTeam(members) {
    if (!members?.length) return;
    const { error } = await supabase.from("team_members").upsert(members.map(toDbMember));
    if (error) console.error("saveTeam:", error.message);
  },
  async softDeleteTeamMember(id) {
    const { error } = await supabase.from("team_members").update({ active: false }).eq("id", id);
    if (error) console.error("softDeleteTeamMember:", error.message);
  },

  // ── Vans ──
  async getVans() {
    const { data, error } = await supabase.from("vans").select("*").order("name");
    if (error) { console.error("getVans:", error.message); return []; }
    if (data?.length) return data.map(fromDbVan);
    // First run — seed Freddy and Dolly
    const { data: seeded, error: seedErr } = await supabase.from("vans").insert(VAN_SEEDS).select();
    if (seedErr) { console.error("seedVans:", seedErr.message); return []; }
    return (seeded || []).map(fromDbVan);
  },
  async saveVans(vans) {
    if (!vans?.length) return;
    const { error } = await supabase.from("vans").upsert(vans.map(toDbVan));
    if (error) {
      console.error("saveVans:", error.message);
      throw new Error(error.message);
    }
  },

  // ── Bookings ──
  async getBookings() {
    const { data, error } = await supabase.from("bookings").select("*").order("start_date");
    if (error) { console.error("getBookings:", error.message); return []; }
    return (data || []).map(fromDbBooking);
  },
  async upsertBooking(booking) {
    const { error } = await supabase.from("bookings").upsert(toDbBooking(booking));
    if (error) {
      console.error("upsertBooking:", error.message);
      throw new Error(error.message);
    }
  },
  async deleteBooking(id) {
    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) console.error("deleteBooking:", error.message);
  },

  // ── Equipment catalogue ──
  async getEquipment() {
    const { data, error } = await supabase.from("equipment_catalogue").select("*").order("sort_order").order("name");
    if (error) { console.error("getEquipment:", error.message); return []; }
    if (data?.length) return data.map(fromDbEquipment);
    // First run — seed default catalogue
    const { data: seeded, error: seedErr } = await supabase.from("equipment_catalogue").insert(EQUIPMENT_SEEDS).select();
    if (seedErr) { console.error("seedEquipment:", seedErr.message); return []; }
    return (seeded || []).map(fromDbEquipment);
  },
  async upsertEquipment(item) {
    const { error } = await supabase.from("equipment_catalogue").upsert(toDbEquipment(item));
    if (error) console.error("upsertEquipment:", error.message);
  },
  async deleteEquipment(id) {
    const { error } = await supabase.from("equipment_catalogue").delete().eq("id", id);
    if (error) console.error("deleteEquipment:", error.message);
  },

  // ── Activity log ──
  async getLogs() {
    const { data, error } = await supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) { console.error("getLogs:", error.message); return []; }
    return (data || []).map(fromDbLog);
  },
  async addLog(entry) {
    const { error } = await supabase.from("activity_log").insert({
      action: entry.action,
      metadata: { who: entry.who, van: entry.van || "" },
    });
    if (error) console.error("addLog:", error.message);
  },

  // ── Pre-departure progress ──
  async getPredepProgress() {
    const { data, error } = await supabase.from("predep_progress").select("*");
    if (error) { console.error("getPredepProgress:", error.message); return {}; }
    const result = {};
    (data || []).forEach(row => { result[row.van_id] = fromDbPredep(row); });
    return result;
  },
  async savePredepProgress(vanId, progressData) {
    if (!vanId) return;
    if (progressData === null) {
      const { error } = await supabase.from("predep_progress").delete().eq("van_id", vanId);
      if (error) console.error("deletePredepProgress:", error.message);
      return;
    }
    const { error } = await supabase.from("predep_progress").upsert({
      van_id: vanId,
      checked: progressData.checked || {},
      notes: progressData.notes || "",
      tyre_data: progressData.tyreData || {},
      pct: progressData.pct || 0,
      checked_count: progressData.checkedCount || 0,
      total_count: progressData.totalCount || 0,
      started_by: progressData.startedBy || null,
      started_at: progressData.startedAt || null,
      last_updated_by: progressData.lastUpdatedBy || null,
      last_updated_at: progressData.lastUpdatedAt || null,
    });
    if (error) console.error("savePredepProgress:", error.message);
  },
};
