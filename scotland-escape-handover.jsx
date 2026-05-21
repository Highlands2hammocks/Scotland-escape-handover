import { useState, useEffect, useCallback } from "react";

const APP_VERSION = "1.2.0";

const genId = () => Math.random().toString(36).slice(2, 10);

// ── Default checklist template for Freddy ──────────────────────
const FREDDY_CHECKLIST = [
  {
    id: "clean_cab", section: "Cleaning — Cab", icon: "🧹",
    items: [
      { id: "cc1", label: "Hoover cab floor and mats", qty: null },
      { id: "cc2", label: "Mop cab floor", qty: null },
      { id: "cc3", label: "Wipe dashboard and steering wheel", qty: null },
      { id: "cc4", label: "Clean all cab windows (inside)", qty: null },
      { id: "cc5", label: "Wipe cab doors and handles", qty: null },
      { id: "cc6", label: "Clean windscreen (inside)", qty: null },
      { id: "cc7", label: "Wipe swivel chair mechanism", qty: null },
    ],
  },
  {
    id: "clean_hab", section: "Cleaning — Habitation", icon: "🧽",
    items: [
      { id: "ch1", label: "Hoover habitation floor", qty: null },
      { id: "ch2", label: "Mop habitation floor", qty: null },
      { id: "ch3", label: "Wipe countertops", qty: null },
      { id: "ch4", label: "Clean habitation windows (inside)", qty: null },
      { id: "ch5", label: "Wipe sliding door and handle", qty: null },
      { id: "ch6", label: "Wipe rear doors and handles", qty: null },
      { id: "ch7", label: "Check and clean all cupboards", qty: null },
      { id: "ch8", label: "Check and clean under bed storage", qty: null },
      { id: "ch9", label: "Wipe fridge inside and out", qty: null },
      { id: "ch10", label: "Clean drawer (utensils/cutlery)", qty: null },
    ],
  },
  {
    id: "clean_bed", section: "Cleaning — Bedding", icon: "🛏️",
    items: [
      { id: "cb1", label: "Strip previous bedding", qty: null },
      { id: "cb2", label: "Fit clean fitted sheet", qty: null },
      { id: "cb3", label: "Fit clean duvet cover on duvet", qty: null },
      { id: "cb4", label: "Fit clean pillow protectors", qty: null },
      { id: "cb5", label: "Fit clean pillow cases", qty: null },
      { id: "cb6", label: "Store bedding under bed correctly", qty: null },
    ],
  },
  {
    id: "inv_kitchen", section: "Inventory — Kitchen", icon: "🍳",
    items: [
      { id: "ik1", label: "Plates", qty: 2 },
      { id: "ik2", label: "Bowls", qty: 2 },
      { id: "ik3", label: "Mugs", qty: 2 },
      { id: "ik4", label: "Forks", qty: 2 },
      { id: "ik5", label: "Knives", qty: 2 },
      { id: "ik6", label: "Spoons", qty: 2 },
      { id: "ik7", label: "Teaspoons", qty: 2 },
      { id: "ik8", label: "Sharp knife", qty: 1 },
      { id: "ik9", label: "Chopping board", qty: 3 },
      { id: "ik10", label: "Spatula", qty: 1 },
      { id: "ik11", label: "Tin opener", qty: 1 },
      { id: "ik12", label: "Bottle opener / corkscrew", qty: 1 },
      { id: "ik13", label: "Pot (small)", qty: 1 },
      { id: "ik14", label: "Pot (medium)", qty: 1 },
      { id: "ik15", label: "Frying pan", qty: 1 },
      { id: "ik16", label: "Tea towel", qty: 1 },
      { id: "ik17", label: "Dish cloth", qty: 1 },
      { id: "ik18", label: "Sponge", qty: 1 },
      { id: "ik19", label: "Washing up liquid", qty: 1 },
    ],
  },
  {
    id: "inv_bedding", section: "Inventory — Bedding & Towels", icon: "🛁",
    items: [
      { id: "ib1", label: "Fitted sheet", qty: 1 },
      { id: "ib2", label: "Duvet", qty: 1 },
      { id: "ib3", label: "Duvet cover", qty: 1 },
      { id: "ib4", label: "Pillows", qty: 2 },
      { id: "ib5", label: "Pillow protectors", qty: 2 },
      { id: "ib6", label: "Pillow cases", qty: 2 },
      { id: "ib7", label: "Bath towels", qty: 2 },
      { id: "ib8", label: "Hand towels", qty: 2 },
    ],
  },
  {
    id: "inv_safety", section: "Inventory — Safety", icon: "🔥",
    items: [
      { id: "is1", label: "Fire extinguisher (in date)", qty: 1 },
      { id: "is2", label: "Fire blanket", qty: 1 },
      { id: "is3", label: "Spare gas canisters", qty: 1 },
    ],
  },
  {
    id: "inv_outdoor", section: "Inventory — Outdoor", icon: "⛺",
    items: [
      { id: "io1", label: "Camping chairs (under storage unit, access via rear doors)", qty: 2 },
    ],
  },
  {
    id: "inv_water", section: "Inventory — Water", icon: "💧",
    items: [
      { id: "iw1", label: "10L water jug", qty: 1 },
      { id: "iw2", label: "Washing bucket", qty: 1 },
    ],
  },
  {
    id: "inv_equip", section: "Inventory — Equipment", icon: "🔌",
    items: [
      { id: "ie1", label: "Electric hook-up cable (orange)", qty: 1 },
      { id: "ie2", label: "Jump leads", qty: 1 },
      { id: "ie3", label: "Camping cooker (under passenger seat)", qty: 1 },
      { id: "ie4", label: "Window covers", qty: 1 },
    ],
  },
  {
    id: "check_exterior", section: "Van Check — Exterior", icon: "🚐",
    items: [
      { id: "ve1", label: "Walk around — check bodywork for new damage", qty: null },
      { id: "ve2", label: "Check all tyres (pressure and condition)", qty: null },
      { id: "ve3", label: "Check windscreen for chips or cracks", qty: null },
      { id: "ve4", label: "Check all lights working (headlights, indicators, brake, reverse)", qty: null },
      { id: "ve5", label: "Clean exterior windows", qty: null },
      { id: "ve6", label: "Check 230v hook-up receptor under rear door", qty: null },
    ],
  },
  {
    id: "check_cab", section: "Van Check — Cab", icon: "🪑",
    items: [
      { id: "vc1", label: "Start engine — check warning lights clear", qty: null },
      { id: "vc2", label: "Check fuel level", qty: null },
      { id: "vc3", label: "Test parking sensors", qty: null },
      { id: "vc4", label: "Test Bluetooth connectivity", qty: null },
      { id: "vc5", label: "Note: CarPlay may not work with newer phones", qty: null },
      { id: "vc6", label: "Check swivel chair locks in both positions", qty: null },
    ],
  },
  {
    id: "check_electrics", section: "Van Check — Electrics", icon: "⚡",
    items: [
      { id: "vl1", label: "Check leisure battery charge level", qty: null },
      { id: "vl2", label: "Test all 12v USB charging ports", qty: null },
      { id: "vl3", label: "Test all lights (switches by sliding door + countertop)", qty: null },
      { id: "vl4", label: "Test 230v system with hook-up cable", qty: null },
    ],
  },
  {
    id: "check_hab", section: "Van Check — Habitation", icon: "🏠",
    items: [
      { id: "vh1", label: "Test fridge — hold power button on left, check it starts", qty: null },
      { id: "vh2", label: "Check fridge main switch by sliding door", qty: null },
      { id: "vh3", label: "Test bed — pull out both drawer sections smoothly", qty: null },
      { id: "vh4", label: "Test back cushion — remove straps, fold flat", qty: null },
      { id: "vh5", label: "Test L-shape seating — pull out front half only", qty: null },
      { id: "vh6", label: "Check drawer hook-latch is secure", qty: null },
      { id: "vh7", label: "Test sliding side door — opens and closes smoothly", qty: null },
      { id: "vh8", label: "Check rear doors open fully", qty: null },
      { id: "vh9", label: "Check all cupboard doors/latches", qty: null },
    ],
  },
];

const DEFAULT_TEAM = [
  { id: "1", name: "Campbell", role: "admin", pin: "1111", active: true },
  { id: "2", name: "Gemma", role: "admin", pin: "2222", active: true },
  { id: "3", name: "Jorja", role: "team", pin: "3333", active: true },
  { id: "4", name: "Michael", role: "team", pin: "4444", active: true },
];

const DEFAULT_VANS = [
  { id: "v1", name: "Freddy", image: "🚐", status: "available", motExpiry: "2026-09-15", taxExpiry: "2026-11-01", insuranceExpiry: "2026-08-20", mileage: 42350, lastPreDeparture: null, lastPostTrip: null, checklistTemplate: "freddy" },
  { id: "v2", name: "Dolly", image: "🚐", status: "available", motExpiry: "2026-07-22", taxExpiry: "2026-10-15", insuranceExpiry: "2026-08-20", mileage: 38120, lastPreDeparture: null, lastPostTrip: null, checklistTemplate: "dolly" },
];

const DEFAULT_TEMPLATES = { freddy: FREDDY_CHECKLIST, dolly: [] };

const store = {
  get: async (key, fb) => { try { const r = await window.storage.get(key); return r ? JSON.parse(r.value) : fb; } catch { return fb; } },
  set: async (key, v) => { try { await window.storage.set(key, JSON.stringify(v)); } catch {} },
};

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
const urgencyColor = (d) => d === null ? "var(--muted)" : d < 0 ? "var(--danger)" : d <= 30 ? "var(--warning)" : "var(--success)";
const statusLabel = { available: "Available", on_rental: "On Rental", in_prep: "In Prep", maintenance: "Maintenance" };
const statusColor = { available: "var(--success)", on_rental: "var(--accent)", in_prep: "var(--warning)", maintenance: "var(--danger)" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@600;700&display=swap');
:root{--bg:#0f1a14;--bg2:#162019;--bg3:#1c2a22;--card:#1e2e24;--card-hover:#253628;--border:#2a3d30;--border-light:#3a5240;--text:#e8ede9;--text-dim:#8fa898;--text-muted:#5a7a64;--accent:#4ecb71;--accent-dim:#3a9956;--accent-glow:rgba(78,203,113,0.15);--success:#4ecb71;--warning:#e8b940;--danger:#e05555;--muted:#5a7a64;--font:'DM Sans',sans-serif;--font-display:'Playfair Display',serif;--radius:12px;--radius-sm:8px;}
*{margin:0;padding:0;box-sizing:border-box;}
.app{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100vh;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
.login-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:linear-gradient(165deg,var(--bg) 0%,#0a1f12 50%,#0f1a14 100%);}
.login-logo{font-family:var(--font-display);font-size:32px;font-weight:700;letter-spacing:-0.5px;margin-bottom:4px;}
.login-sub{font-size:13px;color:var(--text-dim);margin-bottom:48px;letter-spacing:2px;text-transform:uppercase;}
.login-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%;max-width:400px;}
.login-btn{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px 16px;color:var(--text);font-family:var(--font);font-size:18px;font-weight:500;cursor:pointer;transition:all 0.2s;display:flex;flex-direction:column;align-items:center;gap:8px;}
.login-btn:active{transform:scale(0.97);background:var(--card-hover);}
.avatar{width:48px;height:48px;border-radius:50%;background:var(--accent-glow);border:2px solid var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:600;color:var(--accent);}
.login-role{font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;}
.pin-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(8px);}
.pin-box{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:32px;width:320px;text-align:center;}
.pin-box h3{font-size:18px;margin-bottom:8px;}
.pin-sub{font-size:13px;color:var(--text-dim);margin-bottom:24px;}
.pin-dots{display:flex;gap:12px;justify-content:center;margin-bottom:24px;}
.pin-dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--border-light);transition:all 0.15s;}
.pin-dot.filled{background:var(--accent);border-color:var(--accent);}
.pin-dot.error{background:var(--danger);border-color:var(--danger);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
.pin-key{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;font-family:var(--font);font-size:22px;font-weight:500;color:var(--text);cursor:pointer;transition:all 0.15s;}
.pin-key:active{background:var(--bg3);transform:scale(0.95);}
.pin-key.fn{font-size:13px;color:var(--text-dim);}
.pin-error{color:var(--danger);font-size:13px;margin-top:12px;}
.header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--bg2);position:sticky;top:0;z-index:50;}
.header-brand{font-family:var(--font-display);font-size:20px;font-weight:700;}
.header-user{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--text-dim);}
.header-avatar{width:32px;height:32px;border-radius:50%;background:var(--accent-glow);border:1.5px solid var(--accent-dim);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;color:var(--accent);}
.logout-btn{background:none;border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 14px;color:var(--text-dim);font-family:var(--font);font-size:13px;cursor:pointer;}
.nav{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--bg2);overflow-x:auto;-webkit-overflow-scrolling:touch;}
.nav-btn{flex:1;min-width:0;padding:14px 8px;background:none;border:none;font-family:var(--font);font-size:13px;font-weight:500;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:all 0.2s;}
.nav-btn.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--accent-glow);}
.content{padding:20px;max-width:1000px;margin:0 auto;}
.section-title{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-muted);margin-bottom:16px;margin-top:24px;}
.section-title:first-child{margin-top:0;}
.van-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px;}
.van-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
.van-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;}
.van-name{font-family:var(--font-display);font-size:24px;font-weight:700;}
.van-icon{font-size:36px;}
.status-badge{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
.status-dot{width:8px;height:8px;border-radius:50%;}
.van-details{display:flex;flex-direction:column;gap:10px;}
.van-detail{display:flex;justify-content:space-between;align-items:center;font-size:14px;}
.van-detail-label{color:var(--text-dim);}
.van-detail-value{font-weight:500;}
.divider{height:1px;background:var(--border);margin:16px 0;}
.van-checks{display:flex;flex-direction:column;gap:8px;}
.van-check{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--text-dim);}
.van-check-done{color:var(--success);font-weight:500;}
.van-check-pending{color:var(--text-muted);font-style:italic;}
.log-list{display:flex;flex-direction:column;gap:8px;}
.log-item{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;font-size:14px;display:flex;justify-content:space-between;align-items:flex-start;}
.log-text{color:var(--text-dim);flex:1;}.log-text strong{color:var(--text);font-weight:500;}
.log-time{color:var(--text-muted);font-size:12px;white-space:nowrap;margin-left:12px;}
.empty-state{text-align:center;padding:48px 24px;color:var(--text-muted);font-size:14px;}
.mgmt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;}
.mgmt-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
.mgmt-card-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.mgmt-card-name{font-size:18px;font-weight:600;}
.role-badge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
.role-admin{background:rgba(78,203,113,0.15);color:var(--accent);}
.role-team{background:rgba(232,185,64,0.15);color:var(--warning);}
.mgmt-field{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;}
.mgmt-label{font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;}
.input{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-family:var(--font);font-size:15px;outline:none;transition:border 0.2s;}
.input:focus{border-color:var(--accent-dim);}
.input::placeholder{color:var(--text-muted);}
select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235a7a64' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;}
.btn{padding:10px 20px;border-radius:var(--radius-sm);font-family:var(--font);font-size:14px;font-weight:500;cursor:pointer;transition:all 0.15s;border:none;}
.btn:active{transform:scale(0.97);}
.btn:disabled{opacity:0.4;cursor:default;transform:none;}
.btn-primary{background:var(--accent);color:var(--bg);}
.btn-secondary{background:var(--bg2);border:1px solid var(--border);color:var(--text-dim);}
.btn-danger{background:rgba(224,85,85,0.15);border:1px solid rgba(224,85,85,0.3);color:var(--danger);}
.btn-sm{padding:6px 14px;font-size:13px;}
.btn-row{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.add-card{background:var(--bg2);border:2px dashed var(--border);border-radius:var(--radius);padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;cursor:pointer;color:var(--text-muted);font-size:14px;min-height:200px;}
.add-card:active{border-color:var(--accent-dim);color:var(--accent);}
.add-card .plus{font-size:32px;}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px;backdrop-filter:blur(4px);}
.modal{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:28px;width:100%;max-width:440px;max-height:80vh;overflow-y:auto;}
.modal h3{font-size:20px;font-weight:600;margin-bottom:20px;}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--accent);color:var(--bg);padding:10px 24px;border-radius:24px;font-size:14px;font-weight:500;z-index:200;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:toastIn 0.3s ease;}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.cl-van-select{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;}
.cl-van-btn{background:var(--card);border:2px solid var(--border);border-radius:var(--radius);padding:24px;text-align:center;cursor:pointer;transition:all 0.2s;}
.cl-van-btn:active{transform:scale(0.97);}
.cl-van-icon{font-size:40px;margin-bottom:8px;}
.cl-van-name{font-family:var(--font-display);font-size:22px;font-weight:700;}
.cl-van-status{font-size:12px;color:var(--text-dim);margin-top:4px;}
.cl-progress{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.cl-progress-bar-bg{flex:1;height:8px;background:var(--bg);border-radius:4px;overflow:hidden;}
.cl-progress-bar{height:100%;background:var(--accent);border-radius:4px;transition:width 0.3s;}
.cl-progress-text{font-size:14px;font-weight:500;white-space:nowrap;}
.cl-progress-pct{color:var(--accent);font-weight:600;}
.cl-sections{display:flex;flex-direction:column;gap:12px;}
.cl-section{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;}
.cl-section-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer;}
.cl-section-header:active{background:var(--card-hover);}
.cl-section-left{display:flex;align-items:center;gap:12px;}
.cl-section-icon{font-size:24px;}
.cl-section-name{font-size:16px;font-weight:600;}
.cl-section-count{font-size:13px;color:var(--text-dim);}
.cl-section-badge{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;}
.cl-section-badge.complete{background:rgba(78,203,113,0.15);color:var(--success);}
.cl-section-badge.partial{background:rgba(232,185,64,0.15);color:var(--warning);}
.cl-section-badge.empty{background:var(--bg2);color:var(--text-muted);}
.cl-items{border-top:1px solid var(--border);padding:8px 0;}
.cl-item{display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;transition:background 0.1s;}
.cl-item:active{background:var(--bg2);}
.cl-checkbox{width:28px;height:28px;border-radius:8px;border:2px solid var(--border-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;font-size:16px;}
.cl-checkbox.checked{background:var(--accent);border-color:var(--accent);color:var(--bg);}
.cl-item-text{flex:1;font-size:15px;line-height:1.4;}
.cl-item-text.done{color:var(--text-dim);text-decoration:line-through;text-decoration-color:var(--text-muted);}
.cl-item-qty{font-size:13px;color:var(--accent);font-weight:600;background:var(--accent-glow);padding:2px 8px;border-radius:8px;white-space:nowrap;}
.cl-edit-btn{background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;padding:4px 8px;font-family:var(--font);}
.cl-actions{display:flex;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid var(--border);}
.cl-complete-banner{background:rgba(78,203,113,0.1);border:1px solid rgba(78,203,113,0.3);border-radius:var(--radius);padding:24px;text-align:center;margin-top:20px;}
.cl-complete-banner h3{color:var(--accent);font-size:18px;margin-bottom:4px;}
.cl-complete-banner p{color:var(--text-dim);font-size:14px;}
.back-btn{background:none;border:none;color:var(--accent);font-family:var(--font);font-size:14px;font-weight:500;cursor:pointer;display:flex;align-items:center;gap:6px;margin-bottom:16px;padding:0;}
@media(max-width:600px){.van-cards,.mgmt-grid{grid-template-columns:1fr;}.cl-van-select{grid-template-columns:1fr;}}
`;

// ── Shared Components ──────────────────────────────────────────
function PinEntry({ user, onSuccess, onCancel }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const handleKey = (k) => {
    if (error) setError(false);
    if (k === "del") return setPin(p => p.slice(0, -1));
    if (k === "cancel") return onCancel();
    if (pin.length >= 4) return;
    const next = pin + k;
    setPin(next);
    if (next.length === 4) {
      if (next === user.pin) setTimeout(() => onSuccess(user), 150);
      else { setError(true); setTimeout(() => { setPin(""); setError(false); }, 800); }
    }
  };
  return (
    <div className="pin-overlay" onClick={onCancel}>
      <div className="pin-box" onClick={e => e.stopPropagation()}>
        <h3>{user.name}</h3><div className="pin-sub">Enter your 4-digit PIN</div>
        <div className="pin-dots">{[0,1,2,3].map(i => <div key={i} className={`pin-dot ${pin.length > i ? (error ? "error" : "filled") : ""}`} />)}</div>
        <div className="pin-pad">
          {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} className="pin-key" onClick={() => handleKey(String(n))}>{n}</button>)}
          <button className="pin-key fn" onClick={() => handleKey("cancel")}>Cancel</button>
          <button className="pin-key" onClick={() => handleKey("0")}>0</button>
          <button className="pin-key fn" onClick={() => handleKey("del")}>⌫</button>
        </div>
        {error && <div className="pin-error">Incorrect PIN</div>}
      </div>
    </div>
  );
}
function Toast({ message }) { return message ? <div className="toast">{message}</div> : null; }
function Modal({ title, onClose, children }) { return (<div className="modal-overlay" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}><h3>{title}</h3>{children}</div></div>); }

// ── Dashboard ──────────────────────────────────────────────────
function Dashboard({ vans, logs, onSetStatus }) {
  return (
    <div className="content">
      <div className="section-title">Fleet Overview</div>
      <div className="van-cards">{vans.map(van => {
        const mot = daysUntil(van.motExpiry), tax = daysUntil(van.taxExpiry), ins = daysUntil(van.insuranceExpiry);
        return (
          <div key={van.id} className="van-card">
            <div className="van-card-header"><div><div className="van-name">{van.name}</div><div style={{ marginTop: 4 }}><span className="status-badge" style={{ background: `${statusColor[van.status]}22`, color: statusColor[van.status] }}><span className="status-dot" style={{ background: statusColor[van.status] }} />{statusLabel[van.status]}</span></div></div><div className="van-icon">{van.image}</div></div>
            <div className="van-details">
              <div className="van-detail"><span className="van-detail-label">Mileage</span><span className="van-detail-value">{van.mileage?.toLocaleString()} mi</span></div>
              <div className="van-detail"><span className="van-detail-label">MOT Expiry</span><span className="van-detail-value" style={{ color: urgencyColor(mot) }}>{fmtDate(van.motExpiry)} {mot !== null && `(${mot}d)`}</span></div>
              <div className="van-detail"><span className="van-detail-label">Road Tax</span><span className="van-detail-value" style={{ color: urgencyColor(tax) }}>{fmtDate(van.taxExpiry)} {tax !== null && `(${tax}d)`}</span></div>
              <div className="van-detail"><span className="van-detail-label">Insurance</span><span className="van-detail-value" style={{ color: urgencyColor(ins) }}>{fmtDate(van.insuranceExpiry)} {ins !== null && `(${ins}d)`}</span></div>
            </div>
            <div className="divider" />
            <div className="van-checks">
              <div className="van-check"><span>Pre-departure check</span>{van.lastPreDeparture ? <span className="van-check-done">✓ {van.lastPreDeparture.by} — {fmtDate(van.lastPreDeparture.date)}</span> : <span className="van-check-pending">Not completed</span>}</div>
              <div className="van-check"><span>Post-trip check</span>{van.lastPostTrip ? <span className="van-check-done">✓ {van.lastPostTrip.by} — {fmtDate(van.lastPostTrip.date)}</span> : <span className="van-check-pending">Not completed</span>}</div>
            </div>
            <div className="divider" />
            <div className="mgmt-field"><label className="mgmt-label">Update Status</label>
              <select className="input" value={van.status} onChange={e => onSetStatus(van.id, e.target.value)}>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
          </div>
        );
      })}</div>
      <div className="section-title">Recent Activity</div>
      {logs.length === 0 ? <div className="empty-state">No activity yet.</div> : (
        <div className="log-list">{logs.slice(0, 20).map((log, i) => (
          <div key={i} className="log-item"><span className="log-text"><strong>{log.who}</strong> {log.action}{log.van ? <> — <strong>{log.van}</strong></> : ""}</span><span className="log-time">{fmtDate(log.date)} {fmtTime(log.date)}</span></div>
        ))}</div>
      )}
    </div>
  );
}

// ── Team Management ────────────────────────────────────────────
function TeamPanel({ team, onUpdate, currentUser }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", role: "team", pin: "" });
  const isAdmin = currentUser.role === "admin";
  const save = () => {
    if (!form.name.trim() || form.pin.length !== 4) return;
    if (modal === "add") onUpdate([...team, { id: genId(), name: form.name.trim(), role: form.role, pin: form.pin, active: true }]);
    else onUpdate(team.map(m => m.id === modal ? { ...m, ...form, name: form.name.trim() } : m));
    setModal(null);
  };
  return (
    <div className="content">
      <div className="section-title">Team Members</div>
      <div className="mgmt-grid">
        {team.map(m => (
          <div key={m.id} className="mgmt-card">
            <div className="mgmt-card-header"><span className="mgmt-card-name">{m.name}</span><span className={`role-badge ${m.role === "admin" ? "role-admin" : "role-team"}`}>{m.role}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">PIN</span><span style={{ fontSize: 14, color: "var(--text-dim)", letterSpacing: 4 }}>••••</span></div>
            {isAdmin && <div className="btn-row">
              <button className="btn btn-secondary btn-sm" onClick={() => { setForm({ name: m.name, role: m.role, pin: m.pin }); setModal(m.id); }}>Edit</button>
              {m.id !== currentUser.id && <button className="btn btn-danger btn-sm" onClick={() => onUpdate(team.filter(t => t.id !== m.id))}>Remove</button>}
            </div>}
          </div>
        ))}
        {isAdmin && <div className="add-card" onClick={() => { setForm({ name: "", role: "team", pin: "" }); setModal("add"); }}><span className="plus">+</span><span>Add Team Member</span></div>}
      </div>
      {modal !== null && <Modal title={modal === "add" ? "Add Team Member" : "Edit Team Member"} onClose={() => setModal(null)}>
        <div className="mgmt-field"><label className="mgmt-label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></div>
        <div className="mgmt-field"><label className="mgmt-label">Role</label><select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="team">Team</option></select></div>
        <div className="mgmt-field"><label className="mgmt-label">4-digit PIN</label><input className="input" value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="e.g. 1234" inputMode="numeric" maxLength={4} /></div>
        <div className="btn-row" style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={save} disabled={!form.name.trim() || form.pin.length !== 4}>{modal === "add" ? "Add Member" : "Save Changes"}</button><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button></div>
      </Modal>}
    </div>
  );
}

// ── Van Management ─────────────────────────────────────────────
function VanPanel({ vans, onUpdate, currentUser }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: "", motExpiry: "", taxExpiry: "", insuranceExpiry: "", mileage: "" });
  const isAdmin = currentUser.role === "admin";
  const save = () => {
    if (!form.name.trim()) return;
    if (modal === "add") onUpdate([...vans, { id: genId(), name: form.name.trim(), image: "🚐", status: "available", motExpiry: form.motExpiry || null, taxExpiry: form.taxExpiry || null, insuranceExpiry: form.insuranceExpiry || null, mileage: parseInt(form.mileage) || 0, lastPreDeparture: null, lastPostTrip: null, checklistTemplate: "custom_" + genId() }]);
    else onUpdate(vans.map(v => v.id === modal ? { ...v, name: form.name.trim(), motExpiry: form.motExpiry || v.motExpiry, taxExpiry: form.taxExpiry || v.taxExpiry, insuranceExpiry: form.insuranceExpiry || v.insuranceExpiry, mileage: parseInt(form.mileage) || v.mileage } : v));
    setModal(null);
  };
  return (
    <div className="content">
      <div className="section-title">Van Fleet</div>
      <div className="mgmt-grid">
        {vans.map(v => (
          <div key={v.id} className="mgmt-card">
            <div className="mgmt-card-header"><span className="mgmt-card-name">{v.name}</span><span style={{ fontSize: 28 }}>{v.image}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Status</span><span style={{ fontSize: 14, color: statusColor[v.status] }}>{statusLabel[v.status]}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Mileage</span><span style={{ fontSize: 14 }}>{v.mileage?.toLocaleString()} mi</span></div>
            <div className="mgmt-field"><span className="mgmt-label">MOT</span><span style={{ fontSize: 14 }}>{fmtDate(v.motExpiry)}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Tax</span><span style={{ fontSize: 14 }}>{fmtDate(v.taxExpiry)}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Insurance</span><span style={{ fontSize: 14 }}>{fmtDate(v.insuranceExpiry)}</span></div>
            {isAdmin && <div className="btn-row"><button className="btn btn-secondary btn-sm" onClick={() => { setForm({ name: v.name, motExpiry: v.motExpiry || "", taxExpiry: v.taxExpiry || "", insuranceExpiry: v.insuranceExpiry || "", mileage: String(v.mileage || "") }); setModal(v.id); }}>Edit</button><button className="btn btn-danger btn-sm" onClick={() => onUpdate(vans.filter(x => x.id !== v.id))}>Remove</button></div>}
          </div>
        ))}
        {isAdmin && <div className="add-card" onClick={() => { setForm({ name: "", motExpiry: "", taxExpiry: "", insuranceExpiry: "", mileage: "" }); setModal("add"); }}><span className="plus">+</span><span>Add Van</span></div>}
      </div>
      {modal !== null && <Modal title={modal === "add" ? "Add Van" : "Edit Van"} onClose={() => setModal(null)}>
        <div className="mgmt-field"><label className="mgmt-label">Van Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Freddy" /></div>
        <div className="mgmt-field"><label className="mgmt-label">Mileage</label><input className="input" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value.replace(/\D/g, "") })} placeholder="Current mileage" inputMode="numeric" /></div>
        <div className="mgmt-field"><label className="mgmt-label">MOT Expiry</label><input className="input" type="date" value={form.motExpiry} onChange={e => setForm({ ...form, motExpiry: e.target.value })} /></div>
        <div className="mgmt-field"><label className="mgmt-label">Road Tax Expiry</label><input className="input" type="date" value={form.taxExpiry} onChange={e => setForm({ ...form, taxExpiry: e.target.value })} /></div>
        <div className="mgmt-field"><label className="mgmt-label">Insurance Renewal</label><input className="input" type="date" value={form.insuranceExpiry} onChange={e => setForm({ ...form, insuranceExpiry: e.target.value })} /></div>
        <div className="btn-row" style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={save} disabled={!form.name.trim()}>{modal === "add" ? "Add Van" : "Save Changes"}</button><button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button></div>
      </Modal>}
    </div>
  );
}

// ── Pre-departure Checklist ────────────────────────────────────
function PreDeparturePanel({ vans, templates, onTemplatesChange, user, onComplete, isAdmin }) {
  const [selectedVan, setSelectedVan] = useState(null);
  const [checked, setChecked] = useState({});
  const [expanded, setExpanded] = useState({});
  const [notes, setNotes] = useState("");
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", qty: "" });
  const [sectionModal, setSectionModal] = useState(false);
  const [newSec, setNewSec] = useState({ name: "", icon: "📋" });

  const van = vans.find(v => v.id === selectedVan);
  const tpl = van ? (templates[van.checklistTemplate] || []) : [];
  const allItems = tpl.flatMap(s => s.items);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && checkedCount === totalCount;

  const toggleItem = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const toggleSection = (id) => setExpanded(p => ({ ...p, [id]: p[id] === false ? true : false }));

  const handleComplete = () => { if (!allDone || !van) return; onComplete(van.id, user.name, notes); setSelectedVan(null); setChecked({}); setExpanded({}); setNotes(""); };

  const saveItem = () => {
    if (!editModal || !van || !editForm.label.trim()) return;
    const tKey = van.checklistTemplate;
    const upd = (templates[tKey] || []).map(s => {
      if (s.id !== editModal.sectionId) return s;
      if (editModal.type === "add") return { ...s, items: [...s.items, { id: genId(), label: editForm.label.trim(), qty: editForm.qty ? parseInt(editForm.qty) : null }] };
      return { ...s, items: s.items.map(it => it.id === editModal.itemId ? { ...it, label: editForm.label.trim(), qty: editForm.qty ? parseInt(editForm.qty) : null } : it) };
    });
    onTemplatesChange({ ...templates, [tKey]: upd });
    setEditModal(null);
  };

  const deleteItem = () => {
    if (!editModal || !van) return;
    const tKey = van.checklistTemplate;
    const upd = (templates[tKey] || []).map(s => s.id === editModal.sectionId ? { ...s, items: s.items.filter(it => it.id !== editModal.itemId) } : s);
    onTemplatesChange({ ...templates, [tKey]: upd });
    setEditModal(null);
  };

  const saveNewSection = () => {
    if (!van || !newSec.name.trim()) return;
    const tKey = van.checklistTemplate;
    onTemplatesChange({ ...templates, [tKey]: [...(templates[tKey] || []), { id: genId(), section: newSec.name.trim(), icon: newSec.icon || "📋", items: [] }] });
    setSectionModal(false);
    setNewSec({ name: "", icon: "📋" });
  };

  const deleteSection = (sectionId) => {
    if (!van) return;
    const tKey = van.checklistTemplate;
    onTemplatesChange({ ...templates, [tKey]: (templates[tKey] || []).filter(s => s.id !== sectionId) });
  };

  if (!selectedVan) {
    return (
      <div className="content">
        <div className="section-title">Select Van for Pre-departure Check</div>
        <div className="cl-van-select">{vans.map(v => (
          <div key={v.id} className="cl-van-btn" onClick={() => { setSelectedVan(v.id); setChecked({}); setExpanded({}); }}>
            <div className="cl-van-icon">{v.image}</div>
            <div className="cl-van-name">{v.name}</div>
            <div className="cl-van-status">{(templates[v.checklistTemplate] || []).length > 0 ? `${(templates[v.checklistTemplate] || []).reduce((a, s) => a + s.items.length, 0)} checklist items` : "No checklist configured"}</div>
          </div>
        ))}</div>
      </div>
    );
  }

  if (tpl.length === 0) {
    return (
      <div className="content">
        <button className="back-btn" onClick={() => setSelectedVan(null)}>← Back</button>
        <div className="empty-state" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>No checklist for {van?.name} yet</div>
          <div style={{ marginBottom: 20 }}>This van needs a checklist before pre-departure checks can begin.</div>
          {isAdmin && <button className="btn btn-primary" onClick={() => setSectionModal(true)}>Add First Section</button>}
        </div>
        {sectionModal && <Modal title="Add Section" onClose={() => setSectionModal(false)}>
          <div className="mgmt-field"><label className="mgmt-label">Section Name</label><input className="input" value={newSec.name} onChange={e => setNewSec({ ...newSec, name: e.target.value })} placeholder="e.g. Cleaning — Cab" /></div>
          <div className="mgmt-field"><label className="mgmt-label">Icon (emoji)</label><input className="input" value={newSec.icon} onChange={e => setNewSec({ ...newSec, icon: e.target.value })} placeholder="📋" /></div>
          <div className="btn-row" style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={saveNewSection} disabled={!newSec.name.trim()}>Add Section</button><button className="btn btn-secondary" onClick={() => setSectionModal(false)}>Cancel</button></div>
        </Modal>}
      </div>
    );
  }

  return (
    <div className="content">
      <button className="back-btn" onClick={() => setSelectedVan(null)}>← Back to van selection</button>
      <div className="cl-progress">
        <span className="cl-progress-text">{van?.name}</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${pct}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{pct}%</span> ({checkedCount}/{totalCount})</span>
      </div>
      <div className="cl-sections">{tpl.map(section => {
        const sChecked = section.items.filter(it => checked[it.id]).length;
        const sTotal = section.items.length;
        const isOpen = expanded[section.id] !== false;
        const badge = sChecked === sTotal && sTotal > 0 ? "complete" : sChecked > 0 ? "partial" : "empty";
        return (
          <div key={section.id} className="cl-section">
            <div className="cl-section-header" onClick={() => toggleSection(section.id)}>
              <div className="cl-section-left">
                <span className="cl-section-icon">{section.icon}</span>
                <div><div className="cl-section-name">{section.section}</div><div className="cl-section-count">{sChecked} of {sTotal} complete</div></div>
              </div>
              <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
            </div>
            {isOpen && (
              <div className="cl-items">
                {section.items.map(item => (
                  <div key={item.id} className="cl-item" onClick={() => toggleItem(item.id)}>
                    <div className={`cl-checkbox ${checked[item.id] ? "checked" : ""}`}>{checked[item.id] && "✓"}</div>
                    <span className={`cl-item-text ${checked[item.id] ? "done" : ""}`}>{item.label}</span>
                    {item.qty !== null && <span className="cl-item-qty">×{item.qty}</span>}
                    {isAdmin && <button className="cl-edit-btn" onClick={e => { e.stopPropagation(); setEditForm({ label: item.label, qty: item.qty !== null ? String(item.qty) : "" }); setEditModal({ type: "edit", sectionId: section.id, itemId: item.id }); }}>edit</button>}
                  </div>
                ))}
                {isAdmin && <div style={{ padding: "8px 20px", display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditForm({ label: "", qty: "" }); setEditModal({ type: "add", sectionId: section.id }); }}>+ Add item</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteSection(section.id)}>Remove section</button>
                </div>}
              </div>
            )}
          </div>
        );
      })}</div>
      {isAdmin && <div style={{ marginTop: 16 }}><button className="btn btn-secondary btn-sm" onClick={() => setSectionModal(true)}>+ Add Section</button></div>}
      {allDone && <div className="cl-complete-banner"><h3>✓ All checks complete</h3><p>{van?.name} is ready for handover</p></div>}
      <div className="mgmt-field" style={{ marginTop: 20 }}><label className="mgmt-label">Notes (optional)</label><input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any issues or observations..." /></div>
      <div className="cl-actions">
        <button className="btn btn-primary" disabled={!allDone} onClick={handleComplete}>{allDone ? "Mark Pre-departure Complete" : `${totalCount - checkedCount} items remaining`}</button>
        <button className="btn btn-secondary" onClick={() => setChecked({})}>Reset</button>
      </div>
      {editModal && <Modal title={editModal.type === "add" ? "Add Item" : "Edit Item"} onClose={() => setEditModal(null)}>
        <div className="mgmt-field"><label className="mgmt-label">Item description</label><input className="input" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} placeholder="e.g. Check tyre pressure" /></div>
        <div className="mgmt-field"><label className="mgmt-label">Quantity (blank for task items)</label><input className="input" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 2" inputMode="numeric" /></div>
        <div className="btn-row" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={saveItem} disabled={!editForm.label.trim()}>{editModal.type === "add" ? "Add Item" : "Save"}</button>
          {editModal.type === "edit" && <button className="btn btn-danger" onClick={deleteItem}>Delete</button>}
          <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
        </div>
      </Modal>}
      {sectionModal && <Modal title="Add Section" onClose={() => setSectionModal(false)}>
        <div className="mgmt-field"><label className="mgmt-label">Section Name</label><input className="input" value={newSec.name} onChange={e => setNewSec({ ...newSec, name: e.target.value })} placeholder="e.g. Inventory — Extras" /></div>
        <div className="mgmt-field"><label className="mgmt-label">Icon (emoji)</label><input className="input" value={newSec.icon} onChange={e => setNewSec({ ...newSec, icon: e.target.value })} placeholder="📋" /></div>
        <div className="btn-row" style={{ marginTop: 20 }}><button className="btn btn-primary" onClick={saveNewSection} disabled={!newSec.name.trim()}>Add Section</button><button className="btn btn-secondary" onClick={() => setSectionModal(false)}>Cancel</button></div>
      </Modal>}
    </div>
  );
}

// ── Placeholder ────────────────────────────────────────────────
function PlaceholderPanel({ title, desc }) {
  return (<div className="content"><div className="empty-state" style={{ paddingTop: 80 }}><div style={{ fontSize: 40, marginBottom: 16 }}>🔧</div><div style={{ fontSize: 18, fontWeight: 500, color: "var(--text)", marginBottom: 8 }}>{title}</div><div>{desc}</div></div></div>);
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [pinTarget, setPinTarget] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState("");
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [vans, setVans] = useState(DEFAULT_VANS);
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    (async () => {
      const t = await store.get("se_team", DEFAULT_TEAM);
      const v = await store.get("se_vans", DEFAULT_VANS);
      const l = await store.get("se_logs", []);
      const tp = await store.get("se_templates", DEFAULT_TEMPLATES);
      setTeam(t); setVans(v); setLogs(l); setTemplates(tp); setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) store.set("se_team", team); }, [team, loaded]);
  useEffect(() => { if (loaded) store.set("se_vans", vans); }, [vans, loaded]);
  useEffect(() => { if (loaded) store.set("se_logs", logs); }, [logs, loaded]);
  useEffect(() => { if (loaded) store.set("se_templates", templates); }, [templates, loaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const addLog = useCallback((action, vanName) => {
    if (!user) return;
    setLogs(prev => [{ who: user.name, action, van: vanName || "", date: new Date().toISOString() }, ...prev]);
  }, [user]);

  const handleLogin = (m) => { setUser(m); setPinTarget(null); showToast(`Welcome back, ${m.name}`); };
  const handleStatusChange = (vanId, s) => {
    setVans(prev => prev.map(v => v.id === vanId ? { ...v, status: s } : v));
    addLog(`set status to ${statusLabel[s]}`, vans.find(v => v.id === vanId)?.name);
    showToast("Status updated");
  };
  const handlePreDepartureComplete = (vanId, byName, notes) => {
    const now = new Date().toISOString();
    setVans(prev => prev.map(v => v.id === vanId ? { ...v, lastPreDeparture: { by: byName, date: now, notes }, status: "available" } : v));
    addLog("completed pre-departure check", vans.find(v => v.id === vanId)?.name);
    showToast(`Pre-departure complete for ${vans.find(v => v.id === vanId)?.name}`);
    setTab("dashboard");
  };

  if (!user) {
    return (
      <div className="app"><style>{css}</style>
        <div className="login-screen">
          <div className="login-logo">Scotland Escape</div><div className="login-sub">Handover System</div>
          <div className="login-grid">{team.filter(m => m.active).map(m => (
            <button key={m.id} className="login-btn" onClick={() => setPinTarget(m)}><div className="avatar">{m.name[0]}</div>{m.name}<span className="login-role">{m.role}</span></button>
          ))}</div>
        </div>
        {pinTarget && <PinEntry user={pinTarget} onSuccess={handleLogin} onCancel={() => setPinTarget(null)} />}
      </div>
    );
  }

  const tabs = [{ id: "dashboard", label: "Dashboard" }, { id: "pre_departure", label: "Pre-departure" }, { id: "handover", label: "Handover" }, { id: "post_trip", label: "Post-trip" }, { id: "team", label: "Team" }, { id: "vans", label: "Vans" }];

  return (
    <div className="app"><style>{css}</style>
      <div className="header">
        <span className="header-brand">Scotland Escape</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="header-user"><div className="header-avatar">{user.name[0]}</div><span>{user.name}</span></div>
          <button className="logout-btn" onClick={() => { setUser(null); setTab("dashboard"); }}>Sign out</button>
        </div>
      </div>
      <div className="nav">{tabs.map(t => <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === "dashboard" && <Dashboard vans={vans} logs={logs} onSetStatus={handleStatusChange} />}
      {tab === "team" && <TeamPanel team={team} onUpdate={t => { setTeam(t); showToast("Team updated"); }} currentUser={user} />}
      {tab === "vans" && <VanPanel vans={vans} onUpdate={v => { setVans(v); showToast("Fleet updated"); }} currentUser={user} />}
      {tab === "pre_departure" && <PreDeparturePanel vans={vans} templates={templates} onTemplatesChange={t => { setTemplates(t); showToast("Checklist updated"); }} user={user} onComplete={handlePreDepartureComplete} isAdmin={user.role === "admin"} />}
      {tab === "handover" && <PlaceholderPanel title="Handover Flow" desc="Phase 3 — Customer check-in, photo capture, van walkthrough with videos." />}
      {tab === "post_trip" && <PlaceholderPanel title="Post-trip Check" desc="Phase 4 — Return inspection, damage reporting, cleaning checklist." />}
      <Toast message={toast} />
    </div>
  );
}
