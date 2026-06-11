import { useState, useEffect, useCallback, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ensureSignedIn, db } from "./supabase.js";

const APP_VERSION = "1.4.0";

// ── Compliance checks ──────────────────────────────────────────
const COMPLIANCE_STEPS = [
  { key: "licenceFront",      label: "Driving licence — front received" },
  { key: "licenceBack",       label: "Driving licence — back received" },
  { key: "address1",          label: "Proof of address 1 (utility bill / bank statement)" },
  { key: "address2",          label: "Proof of address 2 (utility bill / bank statement)" },
  { key: "dvlaCodeRequested", label: "DVLA check code requested from customer" },
  { key: "dvlaCheckDone",     label: "DVLA licence check completed" },
];

const getComplianceStatus = (compliance) => {
  const done = COMPLIANCE_STEPS.filter(s => compliance?.[s.key]).length;
  if (done === COMPLIANCE_STEPS.length) return "complete";
  if (done > 0) return "partial";
  return "empty";
};

const getComplianceMissing = (compliance) =>
  COMPLIANCE_STEPS.filter(s => !compliance?.[s.key]).map(s => s.label);

const genId = () => crypto.randomUUID();

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

const DOLLY_CHECKLIST = [
  {
    id: "d_clean_cab", section: "Cleaning — Cab", icon: "🧹",
    items: [
      { id: "dcc1", label: "Hoover cab floor and mats", qty: null },
      { id: "dcc2", label: "Mop cab floor", qty: null },
      { id: "dcc3", label: "Wipe dashboard and steering wheel", qty: null },
      { id: "dcc4", label: "Clean all cab windows (inside)", qty: null },
      { id: "dcc5", label: "Wipe cab doors and handles", qty: null },
      { id: "dcc6", label: "Clean windscreen (inside)", qty: null },
    ],
  },
  {
    id: "d_clean_hab", section: "Cleaning — Habitation", icon: "🧽",
    items: [
      { id: "dch1", label: "Hoover habitation floor", qty: null },
      { id: "dch2", label: "Mop habitation floor", qty: null },
      { id: "dch3", label: "Wipe countertops and kitchen surfaces", qty: null },
      { id: "dch4", label: "Clean habitation windows (inside)", qty: null },
      { id: "dch5", label: "Wipe all doors and handles", qty: null },
      { id: "dch6", label: "Clean hob, grill and oven", qty: null },
      { id: "dch7", label: "Check and clean all cupboards", qty: null },
      { id: "dch8", label: "Wipe fridge inside and out", qty: null },
      { id: "dch9", label: "Clean sink and drainer", qty: null },
      { id: "dch10", label: "Empty and clean grey water bucket", qty: null },
    ],
  },
  {
    id: "d_clean_bed", section: "Cleaning — Bedding", icon: "🛏️",
    items: [
      { id: "dcb1", label: "Strip previous bedding", qty: null },
      { id: "dcb2", label: "Fit clean fitted sheet", qty: null },
      { id: "dcb3", label: "Fit clean duvet cover on duvet", qty: null },
      { id: "dcb4", label: "Fit clean pillow protectors", qty: null },
      { id: "dcb5", label: "Fit clean pillow cases", qty: null },
      { id: "dcb6", label: "Store bedding correctly", qty: null },
    ],
  },
  {
    id: "d_inv_kitchen", section: "Inventory — Kitchen", icon: "🍳",
    items: [
      { id: "dik1", label: "Plates", qty: 2 },
      { id: "dik2", label: "Bowls", qty: 2 },
      { id: "dik3", label: "Mugs", qty: 2 },
      { id: "dik4", label: "Forks", qty: 2 },
      { id: "dik5", label: "Knives", qty: 2 },
      { id: "dik6", label: "Spoons", qty: 2 },
      { id: "dik7", label: "Teaspoons", qty: 2 },
      { id: "dik8", label: "Sharp knife", qty: 1 },
      { id: "dik9", label: "Chopping board", qty: 3 },
      { id: "dik10", label: "Spatula", qty: 1 },
      { id: "dik11", label: "Tin opener", qty: 1 },
      { id: "dik12", label: "Bottle opener / corkscrew", qty: 1 },
      { id: "dik13", label: "Pot (small)", qty: 1 },
      { id: "dik14", label: "Pot (medium)", qty: 1 },
      { id: "dik15", label: "Frying pan", qty: 1 },
      { id: "dik16", label: "Oven tray", qty: 1 },
      { id: "dik17", label: "Tea towel", qty: 1 },
      { id: "dik18", label: "Dish cloth", qty: 1 },
      { id: "dik19", label: "Sponge", qty: 1 },
      { id: "dik20", label: "Washing up liquid", qty: 1 },
    ],
  },
  {
    id: "d_inv_bedding", section: "Inventory — Bedding & Towels", icon: "🛁",
    items: [
      { id: "dib1", label: "Fitted sheet", qty: 1 },
      { id: "dib2", label: "Duvet", qty: 1 },
      { id: "dib3", label: "Duvet cover", qty: 1 },
      { id: "dib4", label: "Pillows", qty: 2 },
      { id: "dib5", label: "Pillow protectors", qty: 2 },
      { id: "dib6", label: "Pillow cases", qty: 2 },
      { id: "dib7", label: "Bath towels", qty: 2 },
      { id: "dib8", label: "Hand towels", qty: 2 },
    ],
  },
  {
    id: "d_inv_safety", section: "Inventory — Safety", icon: "🔥",
    items: [
      { id: "dis1", label: "Fire extinguisher (in date)", qty: 1 },
      { id: "dis2", label: "Fire blanket", qty: 1 },
      { id: "dis3", label: "Gas bottles (locker accessible from back door)", qty: 2 },
    ],
  },
  {
    id: "d_inv_outdoor", section: "Inventory — Outdoor", icon: "⛺",
    items: [
      { id: "dio1", label: "Camping chairs (stored in hab area)", qty: 2 },
    ],
  },
  {
    id: "d_inv_water", section: "Inventory — Water", icon: "💧",
    items: [
      { id: "diw1", label: "Fill fresh water tank before handover", qty: null },
      { id: "diw2", label: "Grey water bucket positioned under outside pipe", qty: null },
    ],
  },
  {
    id: "d_inv_equip", section: "Inventory — Equipment", icon: "🔌",
    items: [
      { id: "die1", label: "Electric hook-up cable (orange)", qty: 1 },
      { id: "die2", label: "Jump leads", qty: 1 },
      { id: "die3", label: "Window covers", qty: 1 },
      { id: "die4", label: "Dustpan and brush (under oven)", qty: 1 },
    ],
  },
  {
    id: "d_check_exterior", section: "Van Check — Exterior", icon: "🚐",
    items: [
      { id: "dve1", label: "Walk around — check bodywork for new damage", qty: null },
      { id: "dve2", label: "Check all tyres (pressure and condition)", qty: null },
      { id: "dve3", label: "Check windscreen for chips or cracks", qty: null },
      { id: "dve4", label: "Check all lights working (headlights, indicators, brake, reverse)", qty: null },
      { id: "dve5", label: "Clean exterior windows", qty: null },
      { id: "dve6", label: "Check 230v hook-up receptor", qty: null },
      { id: "dve7", label: "Check pop top canvas from outside — no damage or gaps", qty: null },
    ],
  },
  {
    id: "d_check_cab", section: "Van Check — Cab", icon: "🪑",
    items: [
      { id: "dvc1", label: "Start engine — check warning lights clear", qty: null },
      { id: "dvc2", label: "Check fuel level", qty: null },
      { id: "dvc3", label: "Test Bluetooth connectivity", qty: null },
    ],
  },
  {
    id: "d_check_gas", section: "Van Check — Gas", icon: "🔵",
    items: [
      { id: "dvg1", label: "Gas bottle valve turned OFF (must be off when driving)", qty: null },
      { id: "dvg2", label: "Check gas bottle level — replace if low", qty: null },
      { id: "dvg3", label: "Test hob burners (all 2 lit)", qty: null },
      { id: "dvg4", label: "Test grill ignites", qty: null },
      { id: "dvg5", label: "Test oven ignites", qty: null },
    ],
  },
  {
    id: "d_check_electrics", section: "Van Check — Electrics", icon: "⚡",
    items: [
      { id: "dvl1", label: "Check leisure battery charge level", qty: null },
      { id: "dvl2", label: "Test all 12v USB charging ports", qty: null },
      { id: "dvl3", label: "Test all lights", qty: null },
      { id: "dvl4", label: "Test 230v system with hook-up cable", qty: null },
    ],
  },
  {
    id: "d_check_hab", section: "Van Check — Habitation", icon: "🏠",
    items: [
      { id: "dvh1", label: "Test fridge (power button — no master switch on Dolly)", qty: null },
      { id: "dvh2", label: "Test rock and roll bed (handle under seat via left cupboard, lever slides left, bed pulls out)", qty: null },
      { id: "dvh3", label: "Test pop top (undo straps, push up; close by pulling canvas in so nothing sticks out)", qty: null },
      { id: "dvh4", label: "Test sink tap (cold water only)", qty: null },
      { id: "dvh5", label: "Check grey water drain pipe is accessible at rear", qty: null },
      { id: "dvh6", label: "Test sliding door — opens and closes smoothly", qty: null },
      { id: "dvh7", label: "Check all cupboard doors and latches", qty: null },
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

const DEFAULT_TEMPLATES = { freddy: FREDDY_CHECKLIST, dolly: DOLLY_CHECKLIST };

// Post-trip uses the same base checklists but without cleaning sections
// (cleaning is only done during pre-departure prep, not on return)
const DEFAULT_POST_TRIP_TEMPLATES = {
  freddy: FREDDY_CHECKLIST.filter(s => !s.section.startsWith("Cleaning")),
  dolly:  DOLLY_CHECKLIST.filter(s => !s.section.startsWith("Cleaning")),
};

// ── Handover walkthrough templates ─────────────────────────────
const DEFAULT_HANDOVER_TEMPLATES = {
  freddy: [
    {
      id: "ho_ext", section: "Exterior & Tyres", icon: "🚐", videoUrl: "",
      items: [
        { id: "hoe1", label: "Walk around van — note any pre-existing damage with customer" },
        { id: "hoe2", label: "Show tyre condition and correct pressures (50 PSI / 3.5 bar all round)" },
        { id: "hoe3", label: "Show 230v hook-up receptor (rear, under door)" },
        { id: "hoe4", label: "Show reversing camera display in cab" },
      ],
    },
    {
      id: "ho_cab", section: "Cab & Driving", icon: "🪑", videoUrl: "",
      items: [
        { id: "hoc1", label: "⚠️ Headlights DO NOT turn off automatically — must be switched off manually" },
        { id: "hoc2", label: "Show parking sensors (front and rear)" },
        { id: "hoc3", label: "Pair customer phone to Bluetooth / advise CarPlay may not work on newer phones" },
        { id: "hoc4", label: "Show swivel passenger chair — locks in both positions" },
      ],
    },
    {
      id: "ho_elec", section: "Electrics", icon: "⚡", videoUrl: "",
      items: [
        { id: "hol1", label: "Show leisure battery charge level display" },
        { id: "hol2", label: "Show 12v USB charging ports (cab and hab area)" },
        { id: "hol3", label: "Show light switches (by sliding door and on countertop)" },
        { id: "hol4", label: "Demonstrate 230v hook-up — orange cable, receptor at rear" },
        { id: "hol5", label: "Advise: plug in on hook-up overnight whenever possible" },
      ],
    },
    {
      id: "ho_kitchen", section: "Kitchen & Fridge", icon: "🍳", videoUrl: "",
      items: [
        { id: "hok1", label: "Show camping cooker (stored under passenger seat)" },
        { id: "hok2", label: "Demonstrate gas cooker ignition" },
        { id: "hok3", label: "Show 12v fridge — hold power button on left to start" },
        { id: "hok4", label: "Show fridge master switch (by sliding door)" },
        { id: "hok5", label: "Show 10L water jug and washing bucket" },
        { id: "hok6", label: "Show crockery, pots, pans and utensils locations" },
      ],
    },
    {
      id: "ho_bed", section: "Bed & Storage", icon: "🛏️", videoUrl: "",
      items: [
        { id: "hob1", label: "Demonstrate pull-out bed — both drawer sections" },
        { id: "hob2", label: "Show back cushion — remove straps, folds flat for mattress" },
        { id: "hob3", label: "Show L-shape seating — front half only pulls out" },
        { id: "hob4", label: "Show bedding storage under bed" },
        { id: "hob5", label: "Show table — stored in hab, slots into cupboard hole" },
        { id: "hob6", label: "Show camping chairs — accessed via rear doors" },
        { id: "hob7", label: "Show utensil drawer — hook-latch must be secured when driving" },
      ],
    },
    {
      id: "ho_safety", section: "Safety & Emergency", icon: "🔥", videoUrl: "",
      items: [
        { id: "hos1", label: "Show fire extinguisher and fire blanket locations" },
        { id: "hos2", label: "Show spare gas canister location" },
        { id: "hos3", label: "Show jump leads" },
        { id: "hos4", label: "Confirm emergency contact: hello@scotlandescape.com" },
        { id: "hos5", label: "Confirm customer has van keys" },
      ],
    },
  ],
  dolly: [
    {
      id: "dho_ext", section: "Exterior & Tyres", icon: "🚐", videoUrl: "",
      items: [
        { id: "dhoe1", label: "Walk around van — note any pre-existing damage with customer" },
        { id: "dhoe2", label: "Show tyre condition and correct pressures" },
        { id: "dhoe3", label: "Show 230v hook-up receptor" },
        { id: "dhoe4", label: "Show pop top canvas from outside — no gaps or damage" },
      ],
    },
    {
      id: "dho_cab", section: "Cab & Driving", icon: "🪑", videoUrl: "",
      items: [
        { id: "dhoc1", label: "Pair customer phone to Bluetooth" },
        { id: "dhoc2", label: "Show reversing camera display" },
        { id: "dhoc3", label: "⚠️ Gas bottle must be OFF when driving — show valve location at rear" },
      ],
    },
    {
      id: "dho_poptop", section: "Pop Top", icon: "🏕️", videoUrl: "",
      items: [
        { id: "dhop1", label: "Demonstrate opening pop top — undo straps, push up evenly" },
        { id: "dhop2", label: "Demonstrate closing — pull canvas in so nothing sticks out before latching" },
        { id: "dhop3", label: "Show sleeping platform inside pop top" },
      ],
    },
    {
      id: "dho_gas", section: "Gas & Kitchen", icon: "🔵", videoUrl: "",
      items: [
        { id: "dhog1", label: "⚠️ Gas bottle valve OFF when driving (must remind customer every time)" },
        { id: "dhog2", label: "Show gas bottle locker (rear, accessible from outside)" },
        { id: "dhog3", label: "Demonstrate 2-burner hob ignition" },
        { id: "dhog4", label: "Demonstrate grill ignition" },
        { id: "dhog5", label: "Demonstrate oven ignition" },
        { id: "dhog6", label: "Show crockery and pots/pans (right of oven)" },
        { id: "dhog7", label: "Show cutlery location (beside sink)" },
        { id: "dhog8", label: "Show dustpan and brush (under oven)" },
      ],
    },
    {
      id: "dho_elec", section: "Electrics", icon: "⚡", videoUrl: "",
      items: [
        { id: "dhol1", label: "Show leisure battery charge level" },
        { id: "dhol2", label: "Show 12v USB charging ports" },
        { id: "dhol3", label: "Show light switches" },
        { id: "dhol4", label: "Demonstrate 230v hook-up (orange cable)" },
      ],
    },
    {
      id: "dho_water", section: "Water & Sink", icon: "💧", videoUrl: "",
      items: [
        { id: "dhow1", label: "Show sink — cold water only (fresh tank pre-filled by team)" },
        { id: "dhow2", label: "Show grey water drain pipe at rear — bucket must go underneath when using sink" },
        { id: "dhow3", label: "Show grey water bucket storage" },
      ],
    },
    {
      id: "dho_bed", section: "Bed & Storage", icon: "🛏️", videoUrl: "",
      items: [
        { id: "dhob1", label: "Demonstrate rock and roll bed: handle under seat (left cupboard), lever left, pull out" },
        { id: "dhob2", label: "Show bedding: fitted sheet, duvet, pillows" },
        { id: "dhob3", label: "Show camping chairs (in hab area)" },
        { id: "dhob4", label: "Show general storage areas" },
      ],
    },
    {
      id: "dho_safety", section: "Safety & Emergency", icon: "🔥", videoUrl: "",
      items: [
        { id: "dhos1", label: "Show fire extinguisher and fire blanket locations" },
        { id: "dhos2", label: "Show spare gas bottle (under chair in rear storage)" },
        { id: "dhos3", label: "Show jump leads" },
        { id: "dhos4", label: "Confirm emergency contact: hello@scotlandescape.com" },
        { id: "dhos5", label: "Confirm customer has van keys" },
      ],
    },
  ],
};

// ── Default Equipment Catalogue ────────────────────────────────
const DEFAULT_EQUIPMENT = [
  {
    id: "eq_sleeping_bag",
    name: "Sleeping Bag",
    icon: "🛏️",
    qty: 2,
    depositAmount: 20,
    preChecks: [
      { id: "pre_sb1", label: "Machine wash and tumble dry on low heat" },
      { id: "pre_sb2", label: "Check zip runs full length smoothly" },
      { id: "pre_sb3", label: "Check for holes, tears or damage" },
    ],
    postChecks: [
      { id: "post_sb1", label: "Machine wash and tumble dry on return" },
      { id: "post_sb2", label: "Check zip condition — note any faults" },
      { id: "post_sb3", label: "Check for stains, holes or new damage" },
    ],
  },
  {
    id: "eq_paddleboard",
    name: "Paddleboard + Paddle + Leash",
    icon: "🏄",
    qty: 1,
    depositAmount: 50,
    preChecks: [
      { id: "pre_pb1", label: "Check board for cracks or dings — photograph any existing damage" },
      { id: "pre_pb2", label: "Check leash clip and cord for wear" },
      { id: "pre_pb3", label: "Check paddle is assembled correctly and secure" },
      { id: "pre_pb4", label: "Rinse board and dry before issue" },
    ],
    postChecks: [
      { id: "post_pb1", label: "Rinse board, paddle and leash with fresh water" },
      { id: "post_pb2", label: "Check for new cracks, dings or damage" },
      { id: "post_pb3", label: "Check leash and clip condition" },
      { id: "post_pb4", label: "Dry fully before storing" },
    ],
  },
  {
    id: "eq_wetsuit",
    name: "Wetsuit",
    icon: "🌊",
    qty: 2,
    depositAmount: 30,
    preChecks: [
      { id: "pre_ws1", label: "Rinse with fresh water and hang dry before issue" },
      { id: "pre_ws2", label: "Check zip works smoothly full length" },
      { id: "pre_ws3", label: "Check for tears, holes or panel separation" },
    ],
    postChecks: [
      { id: "post_ws1", label: "Rinse with fresh water on return" },
      { id: "post_ws2", label: "Check zip condition — note any damage" },
      { id: "post_ws3", label: "Check for new tears or damage" },
      { id: "post_ws4", label: "Hang dry — do NOT tumble dry" },
    ],
  },
  {
    id: "eq_cooking_set",
    name: "Camping Cooking Set",
    icon: "🍳",
    qty: 1,
    depositAmount: 15,
    preChecks: [
      { id: "pre_ck1", label: "Wash all pots, pans and lids" },
      { id: "pre_ck2", label: "Check all pieces are present" },
      { id: "pre_ck3", label: "Check handles are secure and not loose" },
    ],
    postChecks: [
      { id: "post_ck1", label: "Wash all pieces on return" },
      { id: "post_ck2", label: "Check all pieces returned" },
      { id: "post_ck3", label: "Check for damage — burnt, cracked or bent" },
    ],
  },
  {
    id: "eq_chairs",
    name: "Extra Camping Chairs (×2)",
    icon: "🪑",
    qty: 1,
    depositAmount: 10,
    preChecks: [
      { id: "pre_ch1", label: "Check frames are straight and undamaged" },
      { id: "pre_ch2", label: "Check fabric for tears or staining" },
      { id: "pre_ch3", label: "Test fold and unfold mechanism" },
    ],
    postChecks: [
      { id: "post_ch1", label: "Check frames on return — bent or cracked" },
      { id: "post_ch2", label: "Check fabric for new tears or stains" },
      { id: "post_ch3", label: "Clean and dry before storing" },
    ],
  },
];

// localStorage-backed store (will be replaced by Supabase)
const store = {
  get: async (key, fb) => {
    try {
      const r = localStorage.getItem(key);
      return r ? JSON.parse(r) : fb;
    } catch {
      return fb;
    }
  },
  set: async (key, v) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  },
};

const daysUntil = (d) => d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
const urgencyColor = (d) => d === null ? "var(--muted)" : d < 0 ? "var(--danger)" : d <= 30 ? "var(--warning)" : "var(--success)";
const statusLabel = { available: "Available", on_rental: "On Rental", in_prep: "In Prep", maintenance: "Maintenance" };
const statusColor = { available: "var(--success)", on_rental: "var(--accent)", in_prep: "var(--warning)", maintenance: "var(--danger)" };

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Playfair+Display:wght@600;700&display=swap');
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
.header-user-name{display:inline;}
.logout-btn{background:none;border:1px solid var(--border);border-radius:var(--radius-sm);padding:6px 14px;color:var(--text-dim);font-family:var(--font);font-size:13px;cursor:pointer;}
.hamburger{display:none;background:none;border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 11px;cursor:pointer;color:var(--text-dim);font-size:17px;line-height:1;transition:all 0.2s;}
.hamburger.open{color:var(--accent);border-color:var(--accent-dim);background:var(--accent-glow);}
.mobile-menu{display:none;flex-direction:column;background:var(--bg2);border-bottom:2px solid var(--border);position:sticky;top:65px;z-index:49;}
.mobile-menu.open{display:flex;}
.mobile-menu-btn{display:flex;align-items:center;gap:14px;width:100%;padding:15px 20px;background:none;border:none;border-top:1px solid var(--border);font-family:var(--font);font-size:15px;font-weight:500;color:var(--text-dim);cursor:pointer;text-align:left;transition:background 0.15s;}
.mobile-menu-btn:active{background:rgba(255,255,255,0.04);}
.mobile-menu-btn.active{color:var(--accent);background:var(--accent-glow);}
.mobile-menu-icon{font-size:20px;width:28px;text-align:center;flex-shrink:0;}
.nav{display:flex;gap:0;border-bottom:1px solid var(--border);background:var(--bg2);overflow-x:auto;-webkit-overflow-scrolling:touch;}
.nav-btn{flex:1;min-width:0;padding:14px 8px;background:none;border:none;font-family:var(--font);font-size:13px;font-weight:500;color:var(--text-muted);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:all 0.2s;}
.nav-btn.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--accent-glow);}
@media(max-width:768px){.hamburger{display:flex;align-items:center;justify-content:center;}.header-user-name{display:none;}.logout-btn{padding:6px 10px;font-size:12px;}.nav{display:none;}.mobile-menu{display:none;}.mobile-menu.open{display:flex;}}
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
.input{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-family:var(--font);font-size:15px;outline:none;transition:border 0.2s;box-sizing:border-box;}
.input:focus{border-color:var(--accent-dim);}
.input::placeholder{color:var(--text-muted);}
select.input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%235a7a64' fill='none' stroke-width='1.5'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px;}
.textarea{width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 14px;color:var(--text);font-family:var(--font);font-size:15px;outline:none;transition:border 0.2s;resize:vertical;min-height:80px;box-sizing:border-box;}
.textarea:focus{border-color:var(--accent-dim);}
.textarea::placeholder{color:var(--text-muted);}
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
.step-progress{display:flex;gap:4px;align-items:center;margin-bottom:20px;}
.step-seg{flex:1;height:4px;border-radius:2px;transition:background 0.3s;}
.step-label{font-size:12px;color:var(--text-muted);white-space:nowrap;margin-left:8px;}
.checkin-doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;}
.doc-capture{display:flex;flex-direction:column;align-items:center;gap:6px;background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius-sm);padding:16px 8px;cursor:pointer;transition:all 0.2s;}
.doc-capture.done{border-color:var(--accent-dim);background:var(--accent-glow);}
.section-video{border-radius:var(--radius);overflow:hidden;background:#000;aspect-ratio:16/9;margin-bottom:16px;}
.section-video-placeholder{background:var(--bg2);border:1px dashed var(--border);border-radius:var(--radius);padding:20px;text-align:center;margin-bottom:16px;}
.photo-btn{display:inline-flex;align-items:center;gap:6px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px 14px;font-size:13px;color:var(--text-dim);cursor:pointer;margin-bottom:10px;}
.photo-btn.has-photos{border-color:var(--accent-dim);color:var(--accent);background:var(--accent-glow);}
.section-notes-input{font-size:13px;padding:8px 12px;}
.booking-list{display:flex;flex-direction:column;gap:12px;}
.booking-card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;}
.booking-card.past{opacity:0.55;}
.booking-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}
.booking-van{display:flex;align-items:center;gap:8px;}
.booking-van-name{font-size:16px;font-weight:600;}
.booking-pill{padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap;}
.booking-client{font-size:15px;color:var(--text);margin-bottom:3px;}
.booking-dates{font-size:13px;color:var(--text-dim);}
.booking-notes{font-size:13px;color:var(--text-muted);margin-top:6px;font-style:italic;}
.upcoming-compact{display:flex;flex-direction:column;gap:10px;margin-bottom:4px;}
.upcoming-row{background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
.upcoming-row-left{display:flex;flex-direction:column;gap:2px;}
.upcoming-row-van{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;}
.upcoming-row-client{font-size:14px;color:var(--text);}
.upcoming-row-dates{font-size:12px;color:var(--text-dim);}
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

// ── Rental detail: pre-departure / handover / post-trip captured per booking ──
function RentalDetailModal({ booking, van, templates, handoverTemplates, postTripTemplates, onClose }) {
  const rc = booking.rentalChecks || {};
  const tplKey = van?.checklistTemplate;
  const preDepSections   = (templates?.[tplKey]         || []);
  const handoverSections = (handoverTemplates?.[tplKey] || []);
  const postTripSections = (postTripTemplates?.[tplKey] || templates?.[tplKey] || []);

  const SectionWrap = ({ title, payload, children }) => (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
        {payload ? (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {payload.by} · {fmtDate(payload.date)}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600 }}>Not yet completed</span>
        )}
      </div>
      {payload && children}
    </div>
  );

  const KV = ({ label, value }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text)", textAlign: "right" }}>{value || "—"}</span>
    </div>
  );

  const renderChecked = (checked, sections) => {
    const items = sections.flatMap(s => s.items.map(it => ({ ...it, section: s.section })));
    const done = items.filter(it => checked?.[it.id]);
    if (!items.length) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
          Checklist · {done.length} of {items.length} ticked
        </div>
        <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 12, color: "var(--text-dim)" }}>
          {items.map(it => (
            <div key={it.id} style={{ padding: "3px 0", display: "flex", gap: 8 }}>
              <span style={{ color: checked?.[it.id] ? "var(--success)" : "var(--text-muted)", width: 14, flexShrink: 0 }}>
                {checked?.[it.id] ? "✓" : "○"}
              </span>
              <span style={{ textDecoration: checked?.[it.id] ? "line-through" : "none" }}>{it.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTyre = (data) => {
    if (!data) return null;
    const corners = [["fl","FL"],["fr","FR"],["rl","RL"],["rr","RR"]];
    const hasAny = corners.some(([k]) => data[`${k}_psi`] || data[`${k}_tread`]);
    if (!hasAny) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Tyres</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
          {corners.map(([k, label]) => (
            <div key={k} style={{ background: "var(--bg3)", borderRadius: 6, padding: "6px 8px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>{label}</div>
              <div>{data[`${k}_psi`] || "—"} psi · {data[`${k}_tread`] || "—"} mm</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderNotes = (notes, label = "Notes") =>
    notes ? (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", whiteSpace: "pre-wrap" }}>{notes}</div>
      </div>
    ) : null;

  const renderSectionNotes = (sectionNotes, sections) => {
    const entries = Object.entries(sectionNotes || {}).filter(([, v]) => v && String(v).trim());
    if (!entries.length) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Section notes</div>
        {entries.map(([sid, txt]) => {
          const sec = sections.find(s => s.id === sid);
          return (
            <div key={sid} style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{sec?.section || sid}:</span> {txt}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 4 }}>{van?.name || "Van"} — {booking.clientName}</h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {fmtDate(booking.startDate)} → {fmtDate(booking.endDate)} · {booking.guests} guest{booking.guests !== 1 ? "s" : ""}
        </div>

        <SectionWrap title="Pre-departure" payload={rc.pre_departure}>
          {renderNotes(rc.pre_departure?.notes)}
          {renderTyre(rc.pre_departure?.tyreData)}
          {renderChecked(rc.pre_departure?.checked, preDepSections)}
        </SectionWrap>

        <SectionWrap title="Handover" payload={rc.handover}>
          <KV label="Customer name"   value={rc.handover?.customerName} />
          <KV label="Licence number"  value={rc.handover?.licenceNumber} />
          <KV label="Deposit collected" value={rc.handover?.depositCollected ? "Yes" : "No"} />
          {rc.handover?.docsDone && Object.values(rc.handover.docsDone).some(Boolean) && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Documents</div>
              {Object.entries(rc.handover.docsDone).filter(([, v]) => v).map(([doc]) => (
                <div key={doc} style={{ fontSize: 12, color: "var(--text-dim)", padding: "2px 0" }}>✓ {doc}</div>
              ))}
            </div>
          )}
          {renderChecked(rc.handover?.checked, handoverSections)}
          {renderSectionNotes(rc.handover?.sectionNotes, handoverSections)}
        </SectionWrap>

        <SectionWrap title="Post-trip" payload={rc.post_trip}>
          <KV label="Return mileage"  value={rc.post_trip?.returnInfo?.mileage} />
          <KV label="Fuel level"      value={rc.post_trip?.returnInfo?.fuelLevel} />
          <KV label="Keys returned"   value={rc.post_trip?.returnInfo?.keysReturned ? "Yes" : "No"} />
          <KV label="Customer issues" value={rc.post_trip?.returnInfo?.customerIssues} />
          {renderTyre(rc.post_trip?.tyreData)}
          {renderChecked(rc.post_trip?.checked, postTripSections)}
          {renderSectionNotes(rc.post_trip?.sectionNotes, postTripSections)}
        </SectionWrap>

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function StepProgress({ current, total }) {
  return (
    <div className="step-progress">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="step-seg" style={{
          background: i < current ? "var(--accent)" : i === current ? "var(--accent-dim)" : "var(--bg2)"
        }} />
      ))}
      <span className="step-label">{current + 1} / {total}</span>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
function Dashboard({ vans, logs, bookings, onSetStatus, preDepartureProgress, templates, handoverTemplates, postTripTemplates }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [detailBooking, setDetailBooking] = useState(null);
  const activeBookings = [...(bookings || [])]
    .filter(b => { const e = new Date(b.endDate); e.setHours(0,0,0,0); return e >= today; })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  return (
    <div className="content">
      <div className="section-title">Fleet Overview</div>
      <div className="van-cards">{vans.map(van => {
        const mot = daysUntil(van.motExpiry), tax = daysUntil(van.taxExpiry), ins = daysUntil(van.insuranceExpiry);
        const nextBooking = activeBookings.find(b => b.vanId === van.id);
        const daysToDepart = nextBooking ? (() => {
          const s = new Date(nextBooking.startDate); s.setHours(0, 0, 0, 0);
          return Math.ceil((s - today) / 864e5);
        })() : null;
        const isActiveRental = daysToDepart !== null && daysToDepart <= 0;
        return (
          <div key={van.id} className="van-card">
            <div className="van-card-header"><div><div className="van-name">{van.name}</div><div style={{ marginTop: 4 }}><span className="status-badge" style={{ background: `${statusColor[van.status]}22`, color: statusColor[van.status] }}><span className="status-dot" style={{ background: statusColor[van.status] }} />{statusLabel[van.status]}</span></div></div><div className="van-icon">{van.image}</div></div>
            <div className="van-details">
              <div className="van-detail"><span className="van-detail-label">Mileage</span><span className="van-detail-value">{van.mileage?.toLocaleString()} mi</span></div>
              <div className="van-detail"><span className="van-detail-label">MOT Expiry</span><span className="van-detail-value" style={{ color: urgencyColor(mot) }}>{fmtDate(van.motExpiry)} {mot !== null && `(${mot}d)`}</span></div>
              <div className="van-detail"><span className="van-detail-label">Road Tax</span><span className="van-detail-value" style={{ color: urgencyColor(tax) }}>{fmtDate(van.taxExpiry)} {tax !== null && `(${tax}d)`}</span></div>
              <div className="van-detail"><span className="van-detail-label">Insurance</span><span className="van-detail-value" style={{ color: urgencyColor(ins) }}>{fmtDate(van.insuranceExpiry)} {ins !== null && `(${ins}d)`}</span></div>
            </div>
            {nextBooking && (
              <>
                <div className="divider" />
                <div className="van-detail">
                  <span className="van-detail-label">{isActiveRental ? "Current rental" : "Next rental"}</span>
                  <span className="van-detail-value" style={{ color: daysToDepart !== null && daysToDepart <= 2 && !isActiveRental ? "var(--warning)" : "var(--text)" }}>
                    {nextBooking.clientName}
                    {isActiveRental
                      ? ` — returns ${fmtDate(nextBooking.endDate)}`
                      : daysToDepart === 0 ? " — departs today"
                      : daysToDepart === 1 ? " — departs tomorrow"
                      : ` — departs in ${daysToDepart}d`}
                  </span>
                </div>
              </>
            )}
            <div className="divider" />
            <div className="van-checks">
              <div className="van-check"><span>Pre-departure check</span>
                {preDepartureProgress?.[van.id]
                  ? <span style={{ color: "var(--warning)", fontWeight: 500 }}>⏳ {preDepartureProgress[van.id].pct}% — {preDepartureProgress[van.id].lastUpdatedBy}</span>
                  : van.lastPreDeparture
                  ? <span className="van-check-done">✓ {van.lastPreDeparture.by} — {fmtDate(van.lastPreDeparture.date)}</span>
                  : <span className="van-check-pending">Not completed</span>}
              </div>
              <div className="van-check"><span>Post-trip check</span>{van.lastPostTrip ? <span className="van-check-done">✓ {van.lastPostTrip.by} — {fmtDate(van.lastPostTrip.date)}</span> : <span className="van-check-pending">Not completed</span>}</div>
            </div>
            <div className="divider" />
            <div className="mgmt-field"><label className="mgmt-label">Update Status</label>
              <select className="input" value={van.status} onChange={e => onSetStatus(van.id, e.target.value)}>{Object.entries(statusLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
          </div>
        );
      })}</div>

      {activeBookings.length > 0 && (
        <>
          <div className="section-title">Upcoming Rentals</div>
          <div className="upcoming-compact">
            {activeBookings.map(b => {
              const van = vans.find(v => v.id === b.vanId);
              const start = new Date(b.startDate); start.setHours(0,0,0,0);
              const days = Math.ceil((start - today) / 864e5);
              const isActive = days <= 0;
              const pillColor = isActive
                ? { bg: "rgba(78,203,113,0.15)", color: "var(--success)" }
                : days <= 1 ? { bg: "rgba(224,85,85,0.15)", color: "var(--danger)" }
                : days <= 3 ? { bg: "rgba(232,185,64,0.15)", color: "var(--warning)" }
                : { bg: "var(--bg)", color: "var(--text-muted)" };
              return (
                <div key={b.id} className="upcoming-row" style={{ cursor: "pointer" }} onClick={() => setDetailBooking(b)}>
                  <div className="upcoming-row-left">
                    <div className="upcoming-row-van">
                      <span>{van?.image || "🚐"}</span>
                      <span>{van?.name || "—"}</span>
                    </div>
                    <div className="upcoming-row-client">{b.clientName} · {b.guests} guest{b.guests !== 1 ? "s" : ""}</div>
                    <div className="upcoming-row-dates">{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</div>
                  </div>
                  <span className="booking-pill" style={{ background: pillColor.bg, color: pillColor.color }}>
                    {isActive ? "On rental" : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {detailBooking && (
        <RentalDetailModal
          booking={detailBooking}
          van={vans.find(v => v.id === detailBooking.vanId)}
          templates={templates}
          handoverTemplates={handoverTemplates}
          postTripTemplates={postTripTemplates}
          onClose={() => setDetailBooking(null)}
        />
      )}

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
// ── Latest tyre readings from most recent post-trip check ─────
const TYRE_POSITIONS = [
  { key: "fl", label: "FL" },
  { key: "fr", label: "FR" },
  { key: "rl", label: "RL" },
  { key: "rr", label: "RR" },
];
const TYRE_MIN_PSI_DISPLAY = 50;
const TYRE_MIN_TREAD_DISPLAY = 2;

function TyreSummary({ lastPostTrip }) {
  const data = lastPostTrip?.tyreData || {};
  const hasAny = TYRE_POSITIONS.some(({ key }) => data[`${key}_psi`] || data[`${key}_tread`]);
  return (
    <div className="mgmt-field" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
      <span className="mgmt-label">Tyres (last post-trip)</span>
      {!hasAny ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No post-trip readings yet</span>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {TYRE_POSITIONS.map(({ key, label }) => {
              const psi   = data[`${key}_psi`]   || "";
              const tread = data[`${key}_tread`] || "";
              const psiN   = parseFloat(psi);
              const treadN = parseFloat(tread);
              const psiFail   = !isNaN(psiN)   && psiN   < TYRE_MIN_PSI_DISPLAY;
              const treadFail = !isNaN(treadN) && treadN < TYRE_MIN_TREAD_DISPLAY;
              const fail = psiFail || treadFail;
              return (
                <div key={key} style={{
                  background: fail ? "rgba(239,68,68,0.07)" : "var(--bg3)",
                  border: `1px solid ${fail ? "rgba(239,68,68,0.4)" : "transparent"}`,
                  borderRadius: 6, padding: "6px 8px",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: fail ? "var(--danger)" : "var(--text-muted)", marginBottom: 2 }}>
                    {label}{fail ? " ⚠" : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text)" }}>
                    <span style={{ color: psiFail ? "var(--danger)" : "var(--text)" }}>{psi || "—"} psi</span>
                    {" · "}
                    <span style={{ color: treadFail ? "var(--danger)" : "var(--text)" }}>{tread || "—"} mm</span>
                  </div>
                </div>
              );
            })}
          </div>
          {lastPostTrip?.date && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {lastPostTrip.by ? `${lastPostTrip.by} · ` : ""}{fmtDate(lastPostTrip.date)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

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
            <TyreSummary lastPostTrip={v.lastPostTrip} />
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

// ── Tyre check grid (shared between pre-departure and post-trip) ─
const TYRE_SECTION_IDS = new Set(["check_exterior", "d_check_exterior"]);

const TYRE_MIN_PSI   = 50;   // 3.5 bar
const TYRE_MIN_TREAD = 2;    // mm legal + safety minimum

function TyreGrid({ data, onChange }) {
  const positions = [
    { key: "fl", label: "Front Left" },
    { key: "fr", label: "Front Right" },
    { key: "rl", label: "Rear Left" },
    { key: "rr", label: "Rear Right" },
  ];

  const failingPsi   = positions.filter(({ key }) => { const v = parseFloat(data[`${key}_psi`]);   return !isNaN(v) && v < TYRE_MIN_PSI;   });
  const failingTread = positions.filter(({ key }) => { const v = parseFloat(data[`${key}_tread`]); return !isNaN(v) && v < TYRE_MIN_TREAD; });
  const hasFailures  = failingPsi.length > 0 || failingTread.length > 0;

  return (
    <div style={{ padding: "12px 20px 8px", borderTop: "1px solid var(--border)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
        🔵 Tyre Readings
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
        Minimums: {TYRE_MIN_PSI} PSI / 3.5 bar pressure · {TYRE_MIN_TREAD}mm tread depth
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {positions.map(({ key, label }) => {
          const psiVal   = data[`${key}_psi`]   || "";
          const treadVal = data[`${key}_tread`] || "";
          const psiNum   = parseFloat(psiVal);
          const treadNum = parseFloat(treadVal);
          const psiFail   = !isNaN(psiNum)   && psiNum   < TYRE_MIN_PSI;
          const treadFail = !isNaN(treadNum) && treadNum < TYRE_MIN_TREAD;
          const anyFail   = psiFail || treadFail;
          return (
            <div key={key} style={{
              background: anyFail ? "rgba(239,68,68,0.07)" : "var(--bg3)",
              borderRadius: 8, padding: "10px 12px",
              border: `1px solid ${anyFail ? "rgba(239,68,68,0.4)" : "transparent"}`,
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: anyFail ? "var(--danger)" : "var(--text-muted)" }}>
                {label}{anyFail ? " ⚠" : ""}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, marginBottom: 3, color: psiFail ? "var(--danger)" : "var(--text-muted)", fontWeight: psiFail ? 600 : 400 }}>
                    PSI{psiFail ? ` < ${TYRE_MIN_PSI}!` : ""}
                  </div>
                  <input className="input" inputMode="decimal" placeholder="—"
                    value={psiVal}
                    onChange={e => onChange({ ...data, [`${key}_psi`]: e.target.value.replace(/[^\d.]/g, "") })}
                    style={{ textAlign: "center", fontSize: 14, padding: "6px 8px",
                      borderColor: psiFail ? "var(--danger)" : undefined,
                      color:       psiFail ? "var(--danger)" : undefined }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, marginBottom: 3, color: treadFail ? "var(--danger)" : "var(--text-muted)", fontWeight: treadFail ? 600 : 400 }}>
                    Tread mm{treadFail ? ` < ${TYRE_MIN_TREAD}!` : ""}
                  </div>
                  <input className="input" inputMode="decimal" placeholder="—"
                    value={treadVal}
                    onChange={e => onChange({ ...data, [`${key}_tread`]: e.target.value.replace(/[^\d.]/g, "") })}
                    style={{ textAlign: "center", fontSize: 14, padding: "6px 8px",
                      borderColor: treadFail ? "var(--danger)" : undefined,
                      color:       treadFail ? "var(--danger)" : undefined }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {hasFailures && (
        <div style={{ marginTop: 10, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontWeight: 700, color: "var(--danger)", fontSize: 13, marginBottom: 6 }}>⚠️ Tyre readings below safe minimum</div>
          {failingPsi.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--danger)", marginBottom: 2 }}>
              Low pressure ({TYRE_MIN_PSI} PSI / 3.5 bar min): {failingPsi.map(p => p.label).join(", ")}
            </div>
          )}
          {failingTread.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--danger)" }}>
              Low tread ({TYRE_MIN_TREAD}mm min): {failingTread.map(p => p.label).join(", ")}
            </div>
          )}
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8, fontWeight: 500 }}>
            Van must not go out until all tyres are within safe limits.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compliance checklist per booking ───────────────────────────
function ComplianceChecks({ booking, onUpdate }) {
  const [open, setOpen] = useState(false);
  const compliance = booking.compliance || {};
  const status = getComplianceStatus(compliance);
  const done = COMPLIANCE_STEPS.filter(s => compliance[s.key]).length;
  const total = COMPLIANCE_STEPS.length;

  const toggle = (key) => onUpdate(booking.id, { compliance: { ...compliance, [key]: !compliance[key] } });
  const setField = (key, val) => onUpdate(booking.id, { compliance: { ...compliance, [key]: val } });

  const badgeStyle = {
    complete: { color: "var(--success)", label: "✓ Compliant" },
    partial:  { color: "var(--warning)", label: `${done}/${total} done` },
    empty:    { color: "var(--text-muted)", label: "Not started" },
  }[status];

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
        onClick={() => setOpen(o => !o)}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>🔍 Documents & Licence Checks</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: badgeStyle.color }}>{badgeStyle.label}</span>
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </div>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {COMPLIANCE_STEPS.map((step, i) => (
            <div key={step.key} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
              onClick={() => toggle(step.key)}>
              <div className={`cl-checkbox ${compliance[step.key] ? "checked" : ""}`} style={{ flexShrink: 0, marginTop: 1 }}>
                {compliance[step.key] && "✓"}
              </div>
              <span style={{ fontSize: 14, flex: 1, color: compliance[step.key] ? "var(--text-muted)" : "var(--text)", textDecoration: compliance[step.key] ? "line-through" : "none", lineHeight: 1.4 }}>
                {i + 1}. {step.label}
              </span>
            </div>
          ))}
          {compliance.dvlaCheckDone && (
            <div style={{ paddingLeft: 34 }}>
              <input className="input" style={{ fontSize: 13 }}
                value={compliance.dvlaResult || ""}
                onChange={e => { e.stopPropagation(); setField("dvlaResult", e.target.value); }}
                onClick={e => e.stopPropagation()}
                placeholder="DVLA result — e.g. Clean, or note any endorsements / points" />
            </div>
          )}
          <div>
            <input className="input" style={{ fontSize: 13 }}
              value={compliance.driveLink || ""}
              onChange={e => { e.stopPropagation(); setField("driveLink", e.target.value); }}
              onClick={e => e.stopPropagation()}
              placeholder="📁 Google Drive folder link (optional)" />
            {compliance.driveLink && (
              <a href={compliance.driveLink} target="_blank" rel="noopener noreferrer"
                style={{ display: "inline-block", marginTop: 6, fontSize: 12, color: "var(--accent)" }}
                onClick={e => e.stopPropagation()}>
                Open Drive folder →
              </a>
            )}
          </div>
          {status === "complete" && (
            <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--success)", fontWeight: 500 }}>
              ✓ All checks complete — van cleared for handover
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sortable checklist item (drag-to-reorder, admin only) ──────
function SortableCheckItem({ id, item, checked, onToggle, isAdmin, onEdit, showQty }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="cl-item" onClick={() => onToggle(item.id)}>
      {isAdmin && (
        <span {...attributes} {...listeners} onClick={e => e.stopPropagation()}
          style={{ cursor: "grab", touchAction: "none", color: "var(--border-light)", fontSize: 18, padding: "0 4px 0 0", flexShrink: 0, lineHeight: 1 }}>
          ⠿
        </span>
      )}
      <div className={`cl-checkbox ${checked ? "checked" : ""}`}>{checked && "✓"}</div>
      <span className={`cl-item-text ${checked ? "done" : ""}`}>{item.label}</span>
      {showQty && item.qty !== null && <span className="cl-item-qty">×{item.qty}</span>}
      {isAdmin && onEdit && (
        <button className="cl-edit-btn" onClick={e => { e.stopPropagation(); onEdit(); }}>edit</button>
      )}
    </div>
  );
}

// ── Sortable section wrapper (admin drag-to-reorder) ───────────
function SortableSection({ id, isAdmin, render }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const dragHandleProps = isAdmin ? { ...attributes, ...listeners, onClick: e => e.stopPropagation(), style: { cursor: "grab", touchAction: "none", color: "var(--text-muted)", fontSize: 20, padding: "0 8px 0 0", flexShrink: 0, lineHeight: 1, userSelect: "none" } } : null;
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}>
      {render(dragHandleProps)}
    </div>
  );
}

// ── Pre-departure Checklist ────────────────────────────────────
function PreDeparturePanel({ vans, templates, onTemplatesChange, user, onComplete, isAdmin, savedProgress, onProgressChange, bookings, equipment, onBookingUpdate }) {
  const [selectedVan, setSelectedVan] = useState(null);
  const [checked, setChecked] = useState({});
  const [expanded, setExpanded] = useState({});
  const [notes, setNotes] = useState("");
  const [tyreData, setTyreData] = useState({});
  const [eqBookingId, setEqBookingId] = useState(null);
  const [eqChecked, setEqChecked] = useState({});
  const [eqNotes, setEqNotes] = useState("");
  const [eqExpanded, setEqExpanded] = useState({});
  const [sessionMeta, setSessionMeta] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", qty: "" });
  const [sectionModal, setSectionModal] = useState(false);
  const [newSec, setNewSec] = useState({ name: "", icon: "📋" });

  const van = vans.find(v => v.id === selectedVan);
  const tpl = van ? (templates[van.checklistTemplate] || []) : [];
  const allItems = tpl.flatMap(s => s.items);
  const checkedCount = allItems.filter(it => checked[it.id]).length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && checkedCount === totalCount;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeEqBookings = (bookings || []).filter(b => b.type === "equipment" && !b.preChecksCompleted && !b.postChecksCompleted);
  const eqBooking = eqBookingId ? (bookings || []).find(b => b.id === eqBookingId) : null;
  const eqSections = eqBooking?.equipmentItems?.map(bi => {
    const cat = (equipment || []).find(e => e.id === bi.id);
    return { id: bi.id, icon: cat?.icon || "📦", section: `${cat?.icon || "📦"} ${cat?.name || bi.name}`, items: (cat?.preChecks || []).map(c => ({ id: `${bi.id}__${c.id}`, label: c.label })) };
  }).filter(s => s.items.length > 0) || [];
  const eqCheckedCount = eqSections.flatMap(s => s.items).filter(i => eqChecked[i.id]).length;
  const eqTotalCount = eqSections.flatMap(s => s.items).length;
  const eqPct = eqTotalCount > 0 ? Math.round((eqCheckedCount / eqTotalCount) * 100) : 0;
  const eqAllDone = eqTotalCount > 0 && eqCheckedCount === eqTotalCount;

  const toggleItem = (id) => setChecked(p => ({ ...p, [id]: !p[id] }));
  const toggleSection = (id) => setExpanded(p => ({ ...p, [id]: p[id] === false ? true : false }));

  // Auto-save progress whenever anything changes so any team member can resume
  useEffect(() => {
    if (!selectedVan || !onProgressChange) return;
    onProgressChange(selectedVan, {
      checked, notes, tyreData, pct, checkedCount, totalCount,
      startedBy: sessionMeta?.startedBy || user.name,
      startedAt: sessionMeta?.startedAt || new Date().toISOString(),
      lastUpdatedBy: user.name,
      lastUpdatedAt: new Date().toISOString(),
      vanId: selectedVan,
    });
  }, [checked, notes, tyreData]);

  const handleComplete = () => { if (!allDone || !van) return; onComplete(van.id, user.name, notes, tyreData, checked); setSelectedVan(null); setChecked({}); setExpanded({}); setNotes(""); setTyreData({}); setSessionMeta(null); };

  const handleEqPreComplete = () => {
    if (!eqAllDone || !eqBooking) return;
    onBookingUpdate(eqBooking.id, { preChecksCompleted: true, preChecksBy: user.name, preChecksAt: new Date().toISOString() });
    setEqBookingId(null); setEqChecked({}); setEqNotes("");
  };

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

  const handleSectionDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id || !van) return;
    const tKey = van.checklistTemplate;
    const secs = templates[tKey] || [];
    const oi = secs.findIndex(s => s.id === active.id);
    const ni = secs.findIndex(s => s.id === over.id);
    if (oi === -1 || ni === -1) return;
    onTemplatesChange({ ...templates, [tKey]: arrayMove(secs, oi, ni) });
  };

  if (eqBookingId && eqBooking) {
    return (
      <div className="content">
        <button className="back-btn" onClick={() => { setEqBookingId(null); setEqChecked({}); setEqNotes(""); }}>← Back to selection</button>
        <div className="cl-progress">
          <span className="cl-progress-text">📦 {eqBooking.clientName}</span>
          <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${eqPct}%` }} /></div>
          <span className="cl-progress-text"><span className="cl-progress-pct">{eqPct}%</span> ({eqCheckedCount}/{eqTotalCount})</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
          {eqBooking.equipmentItems.map(i => `${i.icon} ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(" · ")}
        </div>
        <div className="cl-sections">
          {eqSections.map(section => {
            const sDone = section.items.filter(i => eqChecked[i.id]).length;
            const sTotal = section.items.length;
            const isOpen = eqExpanded[section.id] !== false;
            const badge = sDone === sTotal && sTotal > 0 ? "complete" : sDone > 0 ? "partial" : "empty";
            return (
              <div key={section.id} className="cl-section">
                <div className="cl-section-header" onClick={() => setEqExpanded(p => ({ ...p, [section.id]: !isOpen }))}>
                  <div className="cl-section-left">
                    <span className="cl-section-icon">{section.icon}</span>
                    <div><div className="cl-section-name">{section.section}</div><div className="cl-section-count">{sDone} of {sTotal} complete</div></div>
                  </div>
                  <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
                </div>
                {isOpen && (
                  <div className="cl-items">
                    {section.items.map(item => (
                      <div key={item.id} className="cl-item" onClick={() => setEqChecked(p => ({ ...p, [item.id]: !p[item.id] }))}>
                        <div className={`cl-checkbox ${eqChecked[item.id] ? "checked" : ""}`}>{eqChecked[item.id] && "✓"}</div>
                        <span className={`cl-item-text ${eqChecked[item.id] ? "done" : ""}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="mgmt-field" style={{ marginTop: 16 }}>
          <label className="mgmt-label">Notes (optional)</label>
          <input className="input" value={eqNotes} onChange={e => setEqNotes(e.target.value)} placeholder="Any issues before handover..." />
        </div>
        {eqAllDone && <div className="cl-complete-banner"><h3>✓ Pre-check complete</h3><p>Equipment is ready for {eqBooking.clientName}</p></div>}
        <div className="cl-actions">
          <button className="btn btn-primary" disabled={!eqAllDone} onClick={handleEqPreComplete}>
            {eqAllDone ? "Mark Equipment Pre-check Complete" : `${eqTotalCount - eqCheckedCount} items remaining`}
          </button>
        </div>
      </div>
    );
  }

  if (!selectedVan) {
    return (
      <div className="content">
        <div className="section-title">Select Van for Pre-departure Check</div>
        <div className="cl-van-select">{vans.map(v => (
          <div key={v.id} className="cl-van-btn" style={savedProgress?.[v.id] ? { borderColor: "var(--warning)" } : {}}
            onClick={() => {
              const prog = savedProgress?.[v.id];
              if (prog) {
                setChecked(prog.checked || {});
                setNotes(prog.notes || "");
                setTyreData(prog.tyreData || {});
                setSessionMeta({ startedBy: prog.startedBy, startedAt: prog.startedAt });
              } else {
                setChecked({}); setNotes(""); setTyreData({});
                setSessionMeta({ startedBy: user.name, startedAt: new Date().toISOString() });
              }
              setExpanded({});
              setSelectedVan(v.id);
            }}>
            <div className="cl-van-icon">{v.image}</div>
            <div className="cl-van-name">{v.name}</div>
            {savedProgress?.[v.id] ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ height: 4, background: "var(--bg)", borderRadius: 2, overflow: "hidden", margin: "0 auto 4px", width: "80%" }}>
                  <div style={{ height: "100%", background: "var(--warning)", width: `${savedProgress[v.id].pct}%`, borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--warning)", fontWeight: 500 }}>{savedProgress[v.id].pct}% done</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Started by {savedProgress[v.id].startedBy}
                  {savedProgress[v.id].lastUpdatedBy !== savedProgress[v.id].startedBy && ` · last: ${savedProgress[v.id].lastUpdatedBy}`}
                </div>
                <div className="cl-van-status" style={{ color: "var(--warning)", marginTop: 4 }}>Tap to resume →</div>
              </div>
            ) : (
              <div className="cl-van-status">{(templates[v.checklistTemplate] || []).length > 0 ? `${(templates[v.checklistTemplate] || []).reduce((a, s) => a + s.items.length, 0)} checklist items` : "No checklist configured"}</div>
            )}
          </div>
        ))}</div>
        {activeEqBookings.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 24 }}>📦 Equipment Pre-checks Needed</div>
            <div className="cl-van-select">
              {activeEqBookings.map(b => (
                <div key={b.id} className="cl-van-btn" style={{ borderColor: "var(--accent-dim)" }}
                  onClick={() => { setEqBookingId(b.id); setEqChecked({}); setEqNotes(""); setEqExpanded({}); }}>
                  <div className="cl-van-icon">📦</div>
                  <div className="cl-van-name">{b.clientName}</div>
                  <div className="cl-van-status">{b.equipmentItems?.map(i => `${i.icon} ${i.name}`).join(", ")}</div>
                  <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontWeight: 500 }}>Pre-check required →</div>
                </div>
              ))}
            </div>
          </>
        )}
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
      {sessionMeta?.startedBy && sessionMeta.startedBy !== user.name && (
        <div style={{ background: "rgba(232,185,64,0.1)", border: "1px solid rgba(232,185,64,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "var(--warning)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>⏳</span>
          <span>In progress — started by <strong>{sessionMeta.startedBy}</strong>. Picking up where they left off.</span>
        </div>
      )}
      <div className="cl-progress">
        <span className="cl-progress-text">{van?.name}</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${pct}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{pct}%</span> ({checkedCount}/{totalCount})</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={tpl.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="cl-sections">{tpl.map(section => {
            const sChecked = section.items.filter(it => checked[it.id]).length;
            const sTotal = section.items.length;
            const isOpen = expanded[section.id] !== false;
            const badge = sChecked === sTotal && sTotal > 0 ? "complete" : sChecked > 0 ? "partial" : "empty";
            return (
              <SortableSection key={section.id} id={section.id} isAdmin={isAdmin} render={dragHandleProps => (
                <div className="cl-section">
                  <div className="cl-section-header" onClick={() => toggleSection(section.id)}>
                    <div className="cl-section-left">
                      {dragHandleProps && <span {...dragHandleProps}>⠿</span>}
                      <span className="cl-section-icon">{section.icon}</span>
                      <div><div className="cl-section-name">{section.section}</div><div className="cl-section-count">{sChecked} of {sTotal} complete</div></div>
                    </div>
                    <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
                  </div>
                  {isOpen && (
                    <div className="cl-items">
                      <DndContext sensors={sensors} collisionDetection={closestCenter}
                        onDragEnd={({ active, over }) => {
                          if (!active || !over || active.id === over.id || !van) return;
                          const tKey = van.checklistTemplate;
                          const secs = templates[tKey] || [];
                          const sec = secs.find(s => s.id === section.id);
                          if (!sec) return;
                          const oi = sec.items.findIndex(i => i.id === active.id);
                          const ni = sec.items.findIndex(i => i.id === over.id);
                          onTemplatesChange({ ...templates, [tKey]: secs.map(s => s.id === section.id ? { ...s, items: arrayMove(sec.items, oi, ni) } : s) });
                        }}>
                        <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                          {section.items.map(item => (
                            <SortableCheckItem key={item.id} id={item.id} item={item}
                              checked={!!checked[item.id]} onToggle={toggleItem} isAdmin={isAdmin} showQty={true}
                              onEdit={() => { setEditForm({ label: item.label, qty: item.qty !== null ? String(item.qty) : "" }); setEditModal({ type: "edit", sectionId: section.id, itemId: item.id }); }} />
                          ))}
                        </SortableContext>
                      </DndContext>
                      {TYRE_SECTION_IDS.has(section.id) && (
                        <TyreGrid data={tyreData} onChange={setTyreData} vanTemplate={van?.checklistTemplate} />
                      )}
                      {isAdmin && <div style={{ padding: "8px 20px", display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditForm({ label: "", qty: "" }); setEditModal({ type: "add", sectionId: section.id }); }}>+ Add item</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteSection(section.id)}>Remove section</button>
                      </div>}
                    </div>
                  )}
                </div>
              )} />
            );
          })}</div>
        </SortableContext>
      </DndContext>
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

// ── Handover ───────────────────────────────────────────────────
function HandoverPanel({ vans, handoverTemplates, onHandoverTemplatesChange, user, onComplete, isAdmin, bookings, savedProgress, onProgressChange }) {
  const [step, setStep] = useState(0);
  const [selectedVan, setSelectedVan] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [depositCollected, setDepositCollected] = useState(false);
  const [docsDone, setDocsDone] = useState({});
  const [docsFiles, setDocsFiles] = useState({});
  const [checked, setChecked] = useState({});
  const [sectionNotes, setSectionNotes] = useState({});
  const [damageMarks, setDamageMarks] = useState([]);
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [sessionMeta, setSessionMeta] = useState(null);
  const [videoEditModal, setVideoEditModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ label: "" });
  const [sectionModal, setSectionModal] = useState(false);
  const [newSec, setNewSec] = useState({ name: "", icon: "📋" });

  // Auto-save progress whenever anything changes so refresh / tab switch / new device resumes mid-flow
  useEffect(() => {
    if (!selectedVan || !onProgressChange) return;
    onProgressChange(selectedVan, {
      step, customerName, licenceNumber, depositCollected,
      docsDone, checked, sectionNotes, damageMarks, signatureDataUrl,
      startedBy: sessionMeta?.startedBy || user.name,
      startedAt: sessionMeta?.startedAt || new Date().toISOString(),
      lastUpdatedBy: user.name,
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [selectedVan, step, customerName, licenceNumber, depositCollected, docsDone, checked, sectionNotes, damageMarks, signatureDataUrl]);

  const van = vans.find(v => v.id === selectedVan);
  const tpl = van ? (handoverTemplates[van.checklistTemplate] || []) : [];
  // Flow: step 1 = check-in, steps 2..(1+tpl.length) = walkthrough sections,
  // step 2+tpl.length = damage report + customer signature + complete.
  const totalFlowSteps = 1 + tpl.length + 1;
  const damageStep = 2 + tpl.length;
  const onDamageStep = step === damageStep;
  const currentSectionIdx = step - 2;
  const currentSection = step >= 2 && step < damageStep ? tpl[currentSectionIdx] : null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleHandoverItemDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id || !van || !isAdmin || !currentSection) return;
    const tKey = van.checklistTemplate;
    const secs = handoverTemplates[tKey] || [];
    const sec = secs.find(s => s.id === currentSection.id);
    if (!sec) return;
    const oi = sec.items.findIndex(i => i.id === active.id);
    const ni = sec.items.findIndex(i => i.id === over.id);
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: secs.map(s => s.id === currentSection.id ? { ...s, items: arrayMove(sec.items, oi, ni) } : s) });
  };

  const resetAll = () => {
    setStep(0); setSelectedVan(null); setCustomerName(""); setLicenceNumber("");
    setDepositCollected(false); setDocsDone({}); setDocsFiles({}); setChecked({}); setSectionNotes({});
    setDamageMarks([]); setSignatureDataUrl("");
    setSessionMeta(null);
  };

  const saveHandoverItem = () => {
    if (!editModal || !van || !editForm.label.trim()) return;
    const tKey = van.checklistTemplate;
    const upd = (handoverTemplates[tKey] || []).map(s => {
      if (s.id !== editModal.sectionId) return s;
      if (editModal.type === "add") return { ...s, items: [...s.items, { id: genId(), label: editForm.label.trim() }] };
      return { ...s, items: s.items.map(it => it.id === editModal.itemId ? { ...it, label: editForm.label.trim() } : it) };
    });
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: upd });
    setEditModal(null);
  };
  const deleteHandoverItem = () => {
    if (!editModal || !van) return;
    const tKey = van.checklistTemplate;
    const upd = (handoverTemplates[tKey] || []).map(s => s.id === editModal.sectionId ? { ...s, items: s.items.filter(it => it.id !== editModal.itemId) } : s);
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: upd });
    setEditModal(null);
  };
  const saveNewHandoverSection = () => {
    if (!van || !newSec.name.trim()) return;
    const tKey = van.checklistTemplate;
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: [...(handoverTemplates[tKey] || []), { id: genId(), section: newSec.name.trim(), icon: newSec.icon || "📋", items: [] }] });
    setSectionModal(false);
    setNewSec({ name: "", icon: "📋" });
  };
  const deleteHandoverSection = (sectionId) => {
    if (!van) return;
    const tKey = van.checklistTemplate;
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: (handoverTemplates[tKey] || []).filter(s => s.id !== sectionId) });
    setStep(1);
  };

  const moveSectionUp = (sectionId) => {
    if (!van) return;
    const tKey = van.checklistTemplate;
    const secs = handoverTemplates[tKey] || [];
    const idx = secs.findIndex(s => s.id === sectionId);
    if (idx <= 0) return;
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: arrayMove(secs, idx, idx - 1) });
    setStep(s => s - 1);
  };
  const moveSectionDown = (sectionId) => {
    if (!van) return;
    const tKey = van.checklistTemplate;
    const secs = handoverTemplates[tKey] || [];
    const idx = secs.findIndex(s => s.id === sectionId);
    if (idx >= secs.length - 1) return;
    onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: arrayMove(secs, idx, idx + 1) });
    setStep(s => s + 1);
  };

  const handleComplete = () => {
    if (!van || !customerName.trim() || !licenceNumber.trim() || !signatureDataUrl) return;
    onComplete(van.id, user.name, customerName.trim(), licenceNumber.trim(), depositCollected, docsDone, checked, sectionNotes, damageMarks, signatureDataUrl);
    resetAll();
  };

  if (step === 0) return (
    <div className="content">
      <div className="section-title">Select Van for Customer Handover</div>
      <div className="cl-van-select">
        {vans.map(v => {
          const prog = savedProgress?.[v.id];
          return (
          <div key={v.id} className="cl-van-btn" style={prog ? { borderColor: "var(--warning)" } : {}}
            onClick={() => {
              if (prog) {
                setCustomerName(prog.customerName || "");
                setLicenceNumber(prog.licenceNumber || "");
                setDepositCollected(!!prog.depositCollected);
                setDocsDone(prog.docsDone || {});
                setChecked(prog.checked || {});
                setSectionNotes(prog.sectionNotes || {});
                setDamageMarks(prog.damageMarks || []);
                setSignatureDataUrl(prog.signatureDataUrl || "");
                setSessionMeta({ startedBy: prog.startedBy, startedAt: prog.startedAt });
                setSelectedVan(v.id);
                setStep(prog.step || 1);
              } else {
                setCustomerName(""); setLicenceNumber(""); setDepositCollected(false);
                setDocsDone({}); setDocsFiles({}); setChecked({}); setSectionNotes({});
                setDamageMarks([]); setSignatureDataUrl("");
                setSessionMeta({ startedBy: user.name, startedAt: new Date().toISOString() });
                setSelectedVan(v.id);
                setStep(1);
              }
            }}>
            <div className="cl-van-icon">{v.image}</div>
            <div className="cl-van-name">{v.name}</div>
            <div className="cl-van-status" style={{ color: prog ? "var(--warning)" : statusColor[v.status] }}>
              {prog ? `Resume — ${prog.lastUpdatedBy || prog.startedBy || ""}` : statusLabel[v.status]}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );

  if (step === 1) {
    const docs = ["Licence (front)", "Licence (back)", "Proof of Address 1", "Proof of Address 2", "Signed Contract"];
    // Find the most upcoming/current van booking to check compliance
    const relatedBooking = (bookings || [])
      .filter(b => b.type === "van" && b.vanId === selectedVan && !b.postChecksCompleted)
      .sort((a, b) => Math.abs(new Date(a.startDate) - new Date()) - Math.abs(new Date(b.startDate) - new Date()))[0];
    const compStatus = relatedBooking ? getComplianceStatus(relatedBooking.compliance) : null;
    const missing = relatedBooking ? getComplianceMissing(relatedBooking.compliance) : [];
    const isCompliant = compStatus === "complete";
    const hasBooking = !!relatedBooking;
    return (
      <div className="content">
        <button className="back-btn" onClick={() => setStep(0)}>← Back</button>
        <div className="section-title">Customer Check-in — {van?.name}</div>
        <StepProgress current={0} total={totalFlowSteps} />

        <div className="mgmt-card" style={{ marginBottom: 16 }}>
          <div className="mgmt-field">
            <label className="mgmt-label">Customer Name</label>
            <input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name as on licence" />
          </div>
          <div className="mgmt-field">
            <label className="mgmt-label">Driving Licence Number</label>
            <input className="input" value={licenceNumber} onChange={e => setLicenceNumber(e.target.value.toUpperCase())}
              placeholder="e.g. SMITH901215AJ9AB" style={{ fontFamily: "monospace", letterSpacing: 1 }} />
          </div>
        </div>

        <div className="mgmt-card" style={{ marginBottom: 16 }}>
          <div className="mgmt-label" style={{ marginBottom: 12 }}>Document Photos</div>
          <div className="checkin-doc-grid">
            {docs.map(doc => {
              const done = !!docsDone[doc];
              return (
                <label key={doc} className={`doc-capture ${done ? "done" : ""}`}>
                  <span style={{ fontSize: 22 }}>{done ? "✅" : "📷"}</span>
                  <span style={{ fontSize: 12, color: done ? "var(--accent)" : "var(--text-dim)", textAlign: "center", lineHeight: 1.3 }}>{doc}</span>
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setDocsFiles(p => ({ ...p, [doc]: f }));
                      setDocsDone(p => ({ ...p, [doc]: true }));
                    }} />
                </label>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            Photos save to your camera roll. Tap the share button to send them with the photos attached.
          </div>
          <button className="btn btn-secondary" style={{ width: "100%" }} type="button"
            onClick={async () => {
              const dateStr = new Date().toLocaleDateString("en-GB");
              const subject = `Handover Docs — ${customerName || "[Name]"} — ${dateStr}`;
              const body    = `Handover documents for ${customerName || "[Name]"} — ${dateStr}`;
              const files = Object.entries(docsFiles)
                .filter(([, f]) => f)
                .map(([k, f]) => new File([f], `${k.replace(/[^a-z0-9]+/gi, "_")}_${dateStr.replace(/\//g, "-")}.${(f.name.split(".").pop() || "jpg")}`, { type: f.type }));
              if (files.length && navigator.canShare && navigator.canShare({ files })) {
                try {
                  await navigator.share({ files, title: subject, text: `${body}\n\nTo: hello@scotlandescape.com` });
                  return;
                } catch (err) {
                  if (err?.name === "AbortError") return;
                }
              }
              // Fallback: open Mail with body, photos must be attached manually
              window.location.href = `mailto:hello@scotlandescape.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${body}\n\nPlease attach the documents from your camera roll.`)}`;
            }}>
            ✉️ Send Docs to Scotland Escape
          </button>
        </div>

        <div className="mgmt-card" style={{ marginBottom: 20 }}>
          <div className="cl-item" onClick={() => setDepositCollected(p => !p)} style={{ padding: "12px 4px" }}>
            <div className={`cl-checkbox ${depositCollected ? "checked" : ""}`}>{depositCollected && "✓"}</div>
            <span className="cl-item-text">Security deposit collected</span>
          </div>
        </div>

        {hasBooking && !isCompliant && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 8, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, color: "var(--danger)", marginBottom: 8, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              🔒 Compliance checks incomplete — van cannot go out
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>Outstanding:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--text-dim)", display: "flex", flexDirection: "column", gap: 3 }}>
              {missing.map(m => <li key={m}>{m}</li>)}
            </ul>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
              Update checks in the <strong>Bookings</strong> tab, or contact your VA.
            </div>
          </div>
        )}
        {!hasBooking && (
          <div style={{ background: "rgba(232,185,64,0.1)", border: "1px solid rgba(232,185,64,0.3)", borderRadius: 8, padding: "12px 16px", marginBottom: 12, fontSize: 13, color: "var(--warning)" }}>
            ⚠️ No booking found for {van?.name} — verify compliance checks are complete before proceeding.
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%" }}
          disabled={!customerName.trim() || !licenceNumber.trim() || (hasBooking && !isCompliant)}
          onClick={() => setStep(2)}>
          Continue to Van Walkthrough →
        </button>
      </div>
    );
  }

  if (currentSection) {
    const sChecked = currentSection.items.filter(it => checked[it.id]).length;
    const sTotal = currentSection.items.length;
    const isLastSection = currentSectionIdx === tpl.length - 1;

    const saveVideoUrl = (url) => {
      if (!van || !videoEditModal) return;
      const tKey = van.checklistTemplate;
      const upd = (handoverTemplates[tKey] || []).map(s =>
        s.id === videoEditModal.sectionId ? { ...s, videoUrl: url } : s
      );
      onHandoverTemplatesChange({ ...handoverTemplates, [tKey]: upd });
      setVideoEditModal(null);
    };

    return (
      <div className="content">
        <button className="back-btn" onClick={() => setStep(s => s - 1)}>
          ← {currentSectionIdx === 0 ? "Back to Check-in" : "Back"}
        </button>
        <StepProgress current={currentSectionIdx + 1} total={totalFlowSteps} />

        {currentSection.videoUrl ? (
          <div className="section-video">
            <iframe
              src={currentSection.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "www.youtube.com/embed/")}
              style={{ width: "100%", height: "100%", border: "none" }}
              allowFullScreen
            />
          </div>
        ) : (
          <div className="section-video-placeholder">
            <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: isAdmin ? 8 : 0 }}>
              No walkthrough video for this section
            </div>
            {isAdmin && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setVideoEditModal({ sectionId: currentSection.id, url: "" })}>
                + Add YouTube Video
              </button>
            )}
          </div>
        )}

        {isAdmin && currentSection.videoUrl && (
          <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }}
            onClick={() => setVideoEditModal({ sectionId: currentSection.id, url: currentSection.videoUrl })}>
            Edit Video URL
          </button>
        )}

        <div className="cl-section" style={{ marginBottom: 16 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 28 }}>{currentSection.icon}</span>
              <div style={{ flex: 1 }}>
                <div className="cl-section-name">{currentSection.section}</div>
                <div className="cl-section-count">{sChecked} of {sTotal} confirmed</div>
              </div>
              {isAdmin && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button className="btn btn-secondary btn-sm" style={{ padding: "3px 10px", fontSize: 13, lineHeight: 1 }}
                    onClick={() => moveSectionUp(currentSection.id)}
                    disabled={currentSectionIdx === 0} title="Move section earlier">↑</button>
                  <button className="btn btn-secondary btn-sm" style={{ padding: "3px 10px", fontSize: 13, lineHeight: 1 }}
                    onClick={() => moveSectionDown(currentSection.id)}
                    disabled={currentSectionIdx === tpl.length - 1} title="Move section later">↓</button>
                </div>
              )}
            </div>
          </div>
          <div className="cl-items" style={{ borderTop: "none" }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleHandoverItemDragEnd}>
              <SortableContext items={currentSection.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                {currentSection.items.map(item => (
                  <SortableCheckItem key={item.id} id={item.id} item={item}
                    checked={!!checked[item.id]}
                    onToggle={id => setChecked(p => ({ ...p, [id]: !p[id] }))}
                    isAdmin={isAdmin} showQty={false}
                    onEdit={() => { setEditForm({ label: item.label }); setEditModal({ type: "edit", sectionId: currentSection.id, itemId: item.id }); }} />
                ))}
              </SortableContext>
              {isAdmin && (
                <div style={{ padding: "8px 20px", display: "flex", gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditForm({ label: "" }); setEditModal({ type: "add", sectionId: currentSection.id }); }}>+ Add item</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteHandoverSection(currentSection.id)}>Remove section</button>
                </div>
              )}
            </DndContext>
          </div>
        </div>

        <div className="mgmt-field" style={{ marginBottom: 20 }}>
          <label className="mgmt-label">Notes</label>
          <input className="input"
            value={sectionNotes[currentSection.id] || ""}
            onChange={e => setSectionNotes(p => ({ ...p, [currentSection.id]: e.target.value }))}
            placeholder="Any issues or observations..." />
        </div>

        {isLastSection ? (
          <div>
            <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={() => setStep(s => s + 1)}>
              Next: Damage Report &amp; Signature →
            </button>
            {sChecked < sTotal && (
              <div style={{ fontSize: 13, color: "var(--warning)", textAlign: "center" }}>
                ⚠️ {sTotal - sChecked} item{sTotal - sChecked > 1 ? "s" : ""} in this section not yet confirmed
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setStep(s => s + 1)}>
            Next: {tpl[currentSectionIdx + 1]?.section} →
          </button>
        )}

        {isAdmin && (
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSectionModal(true)}>+ Add Section</button>
          </div>
        )}

        {videoEditModal && (
          <Modal title="Set Walkthrough Video" onClose={() => setVideoEditModal(null)}>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
              Paste a YouTube URL (can be unlisted). This video plays for customers during the walkthrough.
            </div>
            <div className="mgmt-field">
              <label className="mgmt-label">YouTube URL</label>
              <input className="input"
                value={videoEditModal.url}
                onChange={e => setVideoEditModal(p => ({ ...p, url: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => saveVideoUrl(videoEditModal.url)}>Save</button>
              {videoEditModal.url && (
                <button className="btn btn-danger" onClick={() => saveVideoUrl("")}>Remove Video</button>
              )}
              <button className="btn btn-secondary" onClick={() => setVideoEditModal(null)}>Cancel</button>
            </div>
          </Modal>
        )}
        {editModal && (
          <Modal title={editModal.type === "add" ? "Add Item" : "Edit Item"} onClose={() => setEditModal(null)}>
            <div className="mgmt-field"><label className="mgmt-label">Item description</label><input className="input" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} placeholder="e.g. Show how the bed folds out" /></div>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={saveHandoverItem} disabled={!editForm.label.trim()}>{editModal.type === "add" ? "Add Item" : "Save"}</button>
              {editModal.type === "edit" && <button className="btn btn-danger" onClick={deleteHandoverItem}>Delete</button>}
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
            </div>
          </Modal>
        )}
        {sectionModal && (
          <Modal title="Add Section" onClose={() => setSectionModal(false)}>
            <div className="mgmt-field"><label className="mgmt-label">Section Name</label><input className="input" value={newSec.name} onChange={e => setNewSec({ ...newSec, name: e.target.value })} placeholder="e.g. Kitchen & Appliances" /></div>
            <div className="mgmt-field"><label className="mgmt-label">Icon (emoji)</label><input className="input" value={newSec.icon} onChange={e => setNewSec({ ...newSec, icon: e.target.value })} placeholder="📋" /></div>
            <div className="btn-row" style={{ marginTop: 20 }}>
              <button className="btn btn-primary" onClick={saveNewHandoverSection} disabled={!newSec.name.trim()}>Add Section</button>
              <button className="btn btn-secondary" onClick={() => setSectionModal(false)}>Cancel</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  if (onDamageStep) {
    return (
      <div className="content">
        <button className="back-btn" onClick={() => setStep(s => s - 1)}>← Back</button>
        <div className="section-title">Damage Report &amp; Signature — {van?.name}</div>
        <StepProgress current={totalFlowSteps - 1} total={totalFlowSteps} />

        <div className="mgmt-card" style={{ marginBottom: 16 }}>
          <div className="mgmt-label" style={{ marginBottom: 6 }}>Existing Damage</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
            Walk around the van with the customer. Tap any panel where there's existing damage — a red ✕ is dropped. Tap an existing ✕ to remove it.
          </div>
          <VanDamageDiagram marks={damageMarks} onChange={setDamageMarks} />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
            {damageMarks.length === 0 ? "No marks yet" : `${damageMarks.length} mark${damageMarks.length === 1 ? "" : "s"} recorded`}
            {damageMarks.length > 0 && (
              <button className="btn btn-secondary btn-sm" style={{ marginLeft: 12 }} onClick={() => setDamageMarks([])}>Clear all</button>
            )}
          </div>
        </div>

        <div className="mgmt-card" style={{ marginBottom: 16 }}>
          <div className="mgmt-label" style={{ marginBottom: 6 }}>Customer Signature</div>
          <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
            By signing, the customer confirms the vehicle condition shown above and accepts the rental terms.
          </div>
          <SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} />
        </div>

        <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }}
          onClick={handleComplete}
          disabled={!signatureDataUrl}>
          ✓ Complete Handover — Set {van?.name} to On Rental
        </button>
        {!signatureDataUrl && (
          <div style={{ fontSize: 13, color: "var(--warning)", textAlign: "center" }}>
            ⚠️ Customer signature required to complete handover
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Damage diagram + signature pad ─────────────────────────────
function VanDamageDiagram({ marks, onChange }) {
  // Five views of a panel van. Coordinates are normalized 0..1 within each
  // view's SVG viewBox so they survive responsive resizing.
  const views = [
    { id: "topDown",       label: "Top-down",       w: 200, h: 320 },
    { id: "driverSide",    label: "Driver side",    w: 320, h: 160 },
    { id: "passengerSide", label: "Passenger side", w: 320, h: 160 },
    { id: "front",         label: "Front",          w: 200, h: 200 },
    { id: "rear",          label: "Rear",           w: 200, h: 200 },
  ];

  const handleTap = (viewId, e, viewW, viewH) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    onChange([...marks, { view: viewId, x: local.x / viewW, y: local.y / viewH }]);
  };

  const removeMark = (idx, e) => {
    e.stopPropagation();
    onChange(marks.filter((_, i) => i !== idx));
  };

  const renderVan = (viewId) => {
    const stroke = "#cbd5e1", fill = "rgba(203,213,225,0.08)";
    if (viewId === "topDown") return (
      <g fill={fill} stroke={stroke} strokeWidth="2">
        <rect x="30" y="20" width="140" height="280" rx="22" />
        <line x1="30" y1="80" x2="170" y2="80" />
        <rect x="50" y="30" width="100" height="40" rx="6" fill="rgba(203,213,225,0.18)" />
        <rect x="60" y="220" width="80" height="65" rx="4" />
        <rect x="20" y="90"  width="14" height="34" rx="3" />
        <rect x="166" y="90" width="14" height="34" rx="3" />
        <rect x="20" y="240" width="14" height="34" rx="3" />
        <rect x="166" y="240" width="14" height="34" rx="3" />
      </g>
    );
    if (viewId === "driverSide" || viewId === "passengerSide") return (
      <g fill={fill} stroke={stroke} strokeWidth="2">
        <path d="M 20 110 L 60 60 L 100 50 L 300 50 L 300 130 L 20 130 Z" />
        <rect x="70" y="60" width="36" height="44" rx="3" fill="rgba(203,213,225,0.2)" />
        <rect x="115" y="60" width="50" height="44" rx="3" fill="rgba(203,213,225,0.12)" />
        <line x1="172" y1="55" x2="172" y2="125" />
        <rect x="178" y="62" width="70" height="40" rx="3" fill="rgba(203,213,225,0.12)" />
        <line x1="255" y1="55" x2="255" y2="125" />
        <circle cx="70"  cy="135" r="16" />
        <circle cx="250" cy="135" r="16" />
      </g>
    );
    if (viewId === "front") return (
      <g fill={fill} stroke={stroke} strokeWidth="2">
        <path d="M 30 150 L 30 80 L 60 30 L 140 30 L 170 80 L 170 150 Z" />
        <rect x="55" y="40" width="90" height="42" rx="4" fill="rgba(203,213,225,0.2)" />
        <rect x="40" y="95" width="120" height="40" rx="4" />
        <rect x="46" y="100" width="32" height="14" rx="2" fill="rgba(203,213,225,0.25)" />
        <rect x="122" y="100" width="32" height="14" rx="2" fill="rgba(203,213,225,0.25)" />
        <circle cx="50"  cy="170" r="14" />
        <circle cx="150" cy="170" r="14" />
      </g>
    );
    // rear
    return (
      <g fill={fill} stroke={stroke} strokeWidth="2">
        <rect x="30" y="30" width="140" height="140" rx="6" />
        <line x1="100" y1="30" x2="100" y2="160" />
        <rect x="38" y="40"  width="58" height="60" rx="3" fill="rgba(203,213,225,0.12)" />
        <rect x="104" y="40" width="58" height="60" rx="3" fill="rgba(203,213,225,0.12)" />
        <circle cx="50"  cy="180" r="14" />
        <circle cx="150" cy="180" r="14" />
      </g>
    );
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
      {views.map(v => (
        <div key={v.id} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 8 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{v.label}</div>
          <svg viewBox={`0 0 ${v.w} ${v.h}`} style={{ width: "100%", height: "auto", touchAction: "manipulation", cursor: "crosshair" }}
            onClick={e => handleTap(v.id, e, v.w, v.h)}>
            {renderVan(v.id)}
            {marks.map((m, i) => m.view !== v.id ? null : (
              <g key={i} onClick={e => removeMark(i, e)} style={{ cursor: "pointer" }}>
                <circle cx={m.x * v.w} cy={m.y * v.h} r="11" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
                <line x1={m.x * v.w - 6} y1={m.y * v.h - 6} x2={m.x * v.w + 6} y2={m.y * v.h + 6} stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={m.x * v.w + 6} y1={m.y * v.h - 6} x2={m.x * v.w - 6} y2={m.y * v.h + 6} stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}

function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef(null);
  const dirtyRef = useRef(false);

  // Restore a saved signature into the canvas when we mount (e.g. resuming a session)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d");
    // High-DPI: backing store at devicePixelRatio
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    if (c.width !== rect.width * dpr) {
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    }
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f1a14";
    if (value && !dirtyRef.current) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = value;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pointerPos = (e) => {
    const c = canvasRef.current;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    drawingRef.current = true;
    dirtyRef.current = true;
    lastRef.current = pointerPos(e);
  };
  const move = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastRef.current = p;
  };
  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(canvasRef.current.toDataURL("image/png"));
  };

  const clear = () => {
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.restore();
    dirtyRef.current = true;
    onChange("");
  };

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
        <canvas ref={canvasRef}
          style={{ display: "block", width: "100%", height: 180, touchAction: "none", cursor: "crosshair" }}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} onPointerCancel={end} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={{ fontSize: 12, color: value ? "var(--accent)" : "var(--text-muted)" }}>
          {value ? "✓ Signed" : "Sign above with your finger or stylus"}
        </span>
        <button className="btn btn-secondary btn-sm" type="button" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

// ── Post-trip Return Check ─────────────────────────────────────
function PostTripPanel({ vans, templates, user, onComplete, bookings, equipment, onBookingUpdate, isAdmin, onTemplatesChange, savedProgress, onProgressChange }) {
  const [selectedVan, setSelectedVan] = useState(null);
  const [phase, setPhase] = useState("vanSelect");
  const [mileage, setMileage] = useState("");
  const [fuelLevel, setFuelLevel] = useState("");
  const [keysReturned, setKeysReturned] = useState(false);
  const [customerIssues, setCustomerIssues] = useState("");
  const [checked, setChecked] = useState({});
  const [sectionNotes, setSectionNotes] = useState({});
  const [photosMap, setPhotosMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [tyreData, setTyreData] = useState({});
  const [sessionMeta, setSessionMeta] = useState(null);
  const [eqBookingId, setEqBookingId] = useState(null);
  const [eqChecked, setEqChecked] = useState({});
  const [eqNotes, setEqNotes] = useState("");
  const [eqExpanded, setEqExpanded] = useState({});
  const [editModal, setEditModal] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", qty: "" });
  const [sectionModal, setSectionModal] = useState(false);
  const [newSec, setNewSec] = useState({ name: "", icon: "📋" });

  // Auto-save post-trip progress whenever anything changes
  useEffect(() => {
    if (!selectedVan || !onProgressChange) return;
    onProgressChange(selectedVan, {
      phase, mileage, fuelLevel, keysReturned, customerIssues,
      checked, sectionNotes, photosMap, tyreData,
      startedBy: sessionMeta?.startedBy || user.name,
      startedAt: sessionMeta?.startedAt || new Date().toISOString(),
      lastUpdatedBy: user.name,
      lastUpdatedAt: new Date().toISOString(),
    });
  }, [selectedVan, phase, mileage, fuelLevel, keysReturned, customerIssues, checked, sectionNotes, photosMap, tyreData]);

  const PHOTO_SECTIONS = new Set([
    "check_exterior", "check_cab", "check_hab",
    "d_check_exterior", "d_check_cab", "d_check_hab",
  ]);

  const van = vans.find(v => v.id === selectedVan);
  const tpl = van ? (templates[van.checklistTemplate] || []) : [];
  const allItems = tpl.flatMap(s => s.items);
  const checkedCount = allItems.filter(it => checked[it.id]).length;
  const totalCount = allItems.length;
  const pct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allDone = totalCount > 0 && checkedCount === totalCount;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeEqReturns = (bookings || []).filter(b => b.type === "equipment" && b.preChecksCompleted && !b.postChecksCompleted);
  const eqBooking = eqBookingId ? (bookings || []).find(b => b.id === eqBookingId) : null;
  const eqSections = eqBooking?.equipmentItems?.map(bi => {
    const cat = (equipment || []).find(e => e.id === bi.id);
    return { id: bi.id, icon: cat?.icon || "📦", section: `${cat?.icon || "📦"} ${cat?.name || bi.name}`, items: (cat?.postChecks || []).map(c => ({ id: `${bi.id}__${c.id}`, label: c.label })) };
  }).filter(s => s.items.length > 0) || [];
  const eqCheckedCount = eqSections.flatMap(s => s.items).filter(i => eqChecked[i.id]).length;
  const eqTotalCount = eqSections.flatMap(s => s.items).length;
  const eqPct = eqTotalCount > 0 ? Math.round((eqCheckedCount / eqTotalCount) * 100) : 0;
  const eqAllDone = eqTotalCount > 0 && eqCheckedCount === eqTotalCount;

  const resetAll = () => {
    setSelectedVan(null); setPhase("vanSelect"); setMileage(""); setFuelLevel("");
    setKeysReturned(false); setCustomerIssues(""); setChecked({}); setSectionNotes({});
    setPhotosMap({}); setExpanded({}); setTyreData({}); setSessionMeta(null);
  };

  const handleComplete = () => {
    if (!van) return;
    onComplete(van.id, user.name, { mileage, fuelLevel, keysReturned, customerIssues }, sectionNotes, tyreData, checked, photosMap);
    resetAll();
  };

  const handleEqPostComplete = () => {
    if (!eqAllDone || !eqBooking) return;
    onBookingUpdate(eqBooking.id, { postChecksCompleted: true, postChecksBy: user.name, postChecksAt: new Date().toISOString() });
    setEqBookingId(null); setEqChecked({}); setEqNotes(""); setEqExpanded({});
  };

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

  const handleSectionDragEnd = ({ active, over }) => {
    if (!active || !over || active.id === over.id || !van || !onTemplatesChange) return;
    const tKey = van.checklistTemplate;
    const secs = templates[tKey] || [];
    const oi = secs.findIndex(s => s.id === active.id);
    const ni = secs.findIndex(s => s.id === over.id);
    if (oi === -1 || ni === -1) return;
    onTemplatesChange({ ...templates, [tKey]: arrayMove(secs, oi, ni) });
  };

  if (eqBookingId && eqBooking) return (
    <div className="content">
      <button className="back-btn" onClick={() => { setEqBookingId(null); setEqChecked({}); setEqNotes(""); setEqExpanded({}); }}>← Back to selection</button>
      <div className="cl-progress">
        <span className="cl-progress-text">📦 {eqBooking.clientName} — Return Check</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${eqPct}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{eqPct}%</span> ({eqCheckedCount}/{eqTotalCount})</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
        {eqBooking.equipmentItems.map(i => `${i.icon} ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(" · ")}
      </div>
      <div className="cl-sections">
        {eqSections.map(section => {
          const sDone = section.items.filter(i => eqChecked[i.id]).length;
          const sTotal = section.items.length;
          const isOpen = eqExpanded[section.id] !== false;
          const badge = sDone === sTotal && sTotal > 0 ? "complete" : sDone > 0 ? "partial" : "empty";
          return (
            <div key={section.id} className="cl-section">
              <div className="cl-section-header" onClick={() => setEqExpanded(p => ({ ...p, [section.id]: !isOpen }))}>
                <div className="cl-section-left">
                  <span className="cl-section-icon">{section.icon}</span>
                  <div><div className="cl-section-name">{section.section}</div><div className="cl-section-count">{sDone} of {sTotal} checked</div></div>
                </div>
                <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
              </div>
              {isOpen && (
                <div className="cl-items">
                  {section.items.map(item => (
                    <div key={item.id} className="cl-item" onClick={() => setEqChecked(p => ({ ...p, [item.id]: !p[item.id] }))}>
                      <div className={`cl-checkbox ${eqChecked[item.id] ? "checked" : ""}`}>{eqChecked[item.id] && "✓"}</div>
                      <span className={`cl-item-text ${eqChecked[item.id] ? "done" : ""}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mgmt-field" style={{ marginTop: 16 }}>
        <label className="mgmt-label">Notes on return condition (optional)</label>
        <input className="input" value={eqNotes} onChange={e => setEqNotes(e.target.value)} placeholder="Any damage, missing items or issues..." />
      </div>
      {eqAllDone && <div className="cl-complete-banner"><h3>✓ Return check complete</h3><p>{eqBooking.clientName}'s equipment is checked in</p></div>}
      <div className="cl-actions">
        <button className="btn btn-primary" disabled={!eqAllDone} onClick={handleEqPostComplete}>
          {eqAllDone ? "Complete Equipment Return" : `${eqTotalCount - eqCheckedCount} items remaining`}
        </button>
      </div>
    </div>
  );

  if (phase === "vanSelect") return (
    <div className="content">
      <div className="section-title">Select Van for Post-trip Check</div>
      <div className="cl-van-select">
        {vans.map(v => {
          const prog = savedProgress?.[v.id];
          return (
          <div key={v.id} className="cl-van-btn" style={prog ? { borderColor: "var(--warning)" } : {}}
            onClick={() => {
              if (prog) {
                setMileage(prog.mileage || "");
                setFuelLevel(prog.fuelLevel || "");
                setKeysReturned(!!prog.keysReturned);
                setCustomerIssues(prog.customerIssues || "");
                setChecked(prog.checked || {});
                setSectionNotes(prog.sectionNotes || {});
                setPhotosMap(prog.photosMap || {});
                setTyreData(prog.tyreData || {});
                setSessionMeta({ startedBy: prog.startedBy, startedAt: prog.startedAt });
                setSelectedVan(v.id);
                setPhase(prog.phase && prog.phase !== "vanSelect" ? prog.phase : "returnInfo");
              } else {
                setMileage(""); setFuelLevel(""); setKeysReturned(false); setCustomerIssues("");
                setChecked({}); setSectionNotes({}); setPhotosMap({}); setTyreData({});
                setSessionMeta({ startedBy: user.name, startedAt: new Date().toISOString() });
                setSelectedVan(v.id);
                setPhase("returnInfo");
              }
            }}>
            <div className="cl-van-icon">{v.image}</div>
            <div className="cl-van-name">{v.name}</div>
            <div className="cl-van-status" style={{ color: prog ? "var(--warning)" : statusColor[v.status] }}>
              {prog ? `Resume — ${prog.lastUpdatedBy || prog.startedBy || ""}` : statusLabel[v.status]}
            </div>
          </div>
          );
        })}
      </div>
      {activeEqReturns.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>📦 Equipment Returns to Check</div>
          <div className="cl-van-select">
            {activeEqReturns.map(b => (
              <div key={b.id} className="cl-van-btn" style={{ borderColor: "var(--accent-dim)" }}
                onClick={() => { setEqBookingId(b.id); setEqChecked({}); setEqNotes(""); setEqExpanded({}); }}>
                <div className="cl-van-icon">📦</div>
                <div className="cl-van-name">{b.clientName}</div>
                <div className="cl-van-status">{b.equipmentItems?.map(i => `${i.icon} ${i.name}`).join(", ")}</div>
                <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontWeight: 500 }}>Return check →</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  if (phase === "returnInfo") return (
    <div className="content">
      <button className="back-btn" onClick={() => setPhase("vanSelect")}>← Back</button>
      <div className="section-title">Customer Return — {van?.name}</div>

      <div className="mgmt-card" style={{ marginBottom: 16 }}>
        <div className="cl-item" onClick={() => setKeysReturned(p => !p)} style={{ padding: "12px 4px", marginBottom: 8 }}>
          <div className={`cl-checkbox ${keysReturned ? "checked" : ""}`}>{keysReturned && "✓"}</div>
          <span className="cl-item-text" style={{ fontWeight: 500 }}>Keys returned</span>
        </div>
        <div className="mgmt-field">
          <label className="mgmt-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Return Mileage</span>
            {mileage && parseInt(mileage) > (van?.mileage || 0) && (
              <span style={{ color: "var(--success)", fontSize: 12, fontWeight: 500 }}>
                +{(parseInt(mileage) - (van?.mileage || 0)).toLocaleString()} mi this trip
              </span>
            )}
            {mileage && parseInt(mileage) > 0 && parseInt(mileage) <= (van?.mileage || 0) && (
              <span style={{ color: "var(--warning)", fontSize: 12 }}>⚠ Lower than current ({van?.mileage?.toLocaleString()} mi)</span>
            )}
          </label>
          <input className="input" value={mileage} onChange={e => setMileage(e.target.value.replace(/\D/g, ""))}
            placeholder={`Current: ${van?.mileage?.toLocaleString() ?? "—"} mi`} inputMode="numeric" />
        </div>
        <div className="mgmt-field">
          <label className="mgmt-label">Fuel Level on Return</label>
          <input className="input" value={fuelLevel} onChange={e => setFuelLevel(e.target.value)}
            placeholder="e.g. Full, ¾, Half, ¼, Empty" />
        </div>
        <div className="mgmt-field">
          <label className="mgmt-label">Customer-reported issues</label>
          <textarea className="textarea" value={customerIssues} onChange={e => setCustomerIssues(e.target.value)}
            placeholder="Any problems or incidents the customer mentioned..." />
        </div>
      </div>

      <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setPhase("inspection")}>
        Continue to Inspection →
      </button>
    </div>
  );

  if (phase === "inspection") return (
    <div className="content">
      <button className="back-btn" onClick={() => setPhase("returnInfo")}>← Back to Return Info</button>

      <div className="cl-progress">
        <span className="cl-progress-text">{van?.name} — Post-trip</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${pct}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{pct}%</span> ({checkedCount}/{totalCount})</span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={tpl.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="cl-sections">
            {tpl.map(section => {
              const sChecked = section.items.filter(it => checked[it.id]).length;
              const sTotal = section.items.length;
              const isOpen = expanded[section.id] !== false;
              const badge = sChecked === sTotal && sTotal > 0 ? "complete" : sChecked > 0 ? "partial" : "empty";
              const canPhoto = PHOTO_SECTIONS.has(section.id);
              const photoCount = photosMap[section.id] || 0;

              return (
                <SortableSection key={section.id} id={section.id} isAdmin={isAdmin} render={dragHandleProps => (
                  <div className="cl-section">
                    <div className="cl-section-header" onClick={() => setExpanded(p => ({ ...p, [section.id]: !isOpen }))}>
                      <div className="cl-section-left">
                        {dragHandleProps && <span {...dragHandleProps}>⠿</span>}
                        <span className="cl-section-icon">{section.icon}</span>
                        <div>
                          <div className="cl-section-name">{section.section}</div>
                          <div className="cl-section-count">{sChecked} of {sTotal} checked</div>
                        </div>
                      </div>
                      <span className={`cl-section-badge ${badge}`}>
                        {badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="cl-items">
                        <DndContext sensors={sensors} collisionDetection={closestCenter}
                          onDragEnd={({ active, over }) => {
                            if (!active || !over || active.id === over.id || !van || !isAdmin || !onTemplatesChange) return;
                            const tKey = van.checklistTemplate;
                            const secs = templates[tKey] || [];
                            const sec = secs.find(s => s.id === section.id);
                            if (!sec) return;
                            const oi = sec.items.findIndex(i => i.id === active.id);
                            const ni = sec.items.findIndex(i => i.id === over.id);
                            onTemplatesChange({ ...templates, [tKey]: secs.map(s => s.id === section.id ? { ...s, items: arrayMove(sec.items, oi, ni) } : s) });
                          }}>
                          <SortableContext items={section.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                            {section.items.map(item => (
                              <SortableCheckItem key={item.id} id={item.id} item={item}
                                checked={!!checked[item.id]}
                                onToggle={id => setChecked(p => ({ ...p, [id]: !p[id] }))}
                                isAdmin={isAdmin} showQty={true}
                                onEdit={() => { setEditForm({ label: item.label, qty: item.qty !== null ? String(item.qty) : "" }); setEditModal({ type: "edit", sectionId: section.id, itemId: item.id }); }} />
                            ))}
                          </SortableContext>
                        </DndContext>
                        {TYRE_SECTION_IDS.has(section.id) && (
                          <TyreGrid data={tyreData} onChange={setTyreData} vanTemplate={van?.checklistTemplate} />
                        )}
                        <div style={{ padding: "10px 20px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                          {canPhoto && (
                            <label className={`photo-btn ${photoCount > 0 ? "has-photos" : ""}`}>
                              📷 {photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? "s" : ""} taken` : "Take photos of this section"}
                              <input type="file" accept="image/*" capture="environment" multiple style={{ display: "none" }}
                                onChange={e => setPhotosMap(p => ({ ...p, [section.id]: (p[section.id] || 0) + e.target.files.length }))} />
                            </label>
                          )}
                          <input className="input section-notes-input"
                            value={sectionNotes[section.id] || ""}
                            onChange={e => setSectionNotes(p => ({ ...p, [section.id]: e.target.value }))}
                            placeholder="Note any issues in this section..." />
                        </div>
                        {isAdmin && onTemplatesChange && (
                          <div style={{ padding: "8px 20px", display: "flex", gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditForm({ label: "", qty: "" }); setEditModal({ type: "add", sectionId: section.id }); }}>+ Add item</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteSection(section.id)}>Remove section</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )} />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {isAdmin && onTemplatesChange && (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setSectionModal(true)}>+ Add Section</button>
        </div>
      )}

      {allDone && (
        <div className="cl-complete-banner">
          <h3>✓ Inspection complete</h3>
          <p>{van?.name} post-trip check finished</p>
          {mileage && (
            <p style={{ marginTop: 6, fontSize: 13, color: "var(--accent)" }}>
              Van profile will update to {parseInt(mileage).toLocaleString()} mi
              {parseInt(mileage) > (van?.mileage || 0) && ` (+${(parseInt(mileage) - (van?.mileage || 0)).toLocaleString()} mi this trip)`}
            </p>
          )}
        </div>
      )}

      <div className="cl-actions">
        <button className="btn btn-primary" onClick={handleComplete}>
          Complete Post-trip Check
        </button>
        <button className="btn btn-secondary" onClick={() => setChecked({})}>Reset Checks</button>
      </div>
      {editModal && (
        <Modal title={editModal.type === "add" ? "Add Item" : "Edit Item"} onClose={() => setEditModal(null)}>
          <div className="mgmt-field"><label className="mgmt-label">Item description</label><input className="input" value={editForm.label} onChange={e => setEditForm({ ...editForm, label: e.target.value })} placeholder="e.g. Check tyre pressure" /></div>
          <div className="mgmt-field"><label className="mgmt-label">Quantity (blank for task items)</label><input className="input" value={editForm.qty} onChange={e => setEditForm({ ...editForm, qty: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 2" inputMode="numeric" /></div>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveItem} disabled={!editForm.label.trim()}>{editModal.type === "add" ? "Add Item" : "Save"}</button>
            {editModal.type === "edit" && <button className="btn btn-danger" onClick={deleteItem}>Delete</button>}
            <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
      {sectionModal && (
        <Modal title="Add Section" onClose={() => setSectionModal(false)}>
          <div className="mgmt-field"><label className="mgmt-label">Section Name</label><input className="input" value={newSec.name} onChange={e => setNewSec({ ...newSec, name: e.target.value })} placeholder="e.g. Inventory — Extras" /></div>
          <div className="mgmt-field"><label className="mgmt-label">Icon (emoji)</label><input className="input" value={newSec.icon} onChange={e => setNewSec({ ...newSec, icon: e.target.value })} placeholder="📋" /></div>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveNewSection} disabled={!newSec.name.trim()}>Add Section</button>
            <button className="btn btn-secondary" onClick={() => setSectionModal(false)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );

  return null;
}

// ── Bookings ───────────────────────────────────────────────────
function BookingsPanel({ vans, bookings, onUpdate, onBookingUpdate, isAdmin, equipment }) {
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({
    type: "van", vanId: "", clientName: "", guests: "2",
    startDate: "", endDate: "", notes: "",
    equipmentItems: {}, depositCollected: false,
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const bookingStatus = (b) => {
    const s = new Date(b.startDate); s.setHours(0,0,0,0);
    const e = new Date(b.endDate); e.setHours(0,0,0,0);
    if (e < today) return "past";
    if (s <= today) return "active";
    return "upcoming";
  };
  const daysUntilStart = (b) => {
    const s = new Date(b.startDate); s.setHours(0,0,0,0);
    return Math.ceil((s - today) / 864e5);
  };

  const sorted = [...bookings].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const upcoming = sorted.filter(b => bookingStatus(b) !== "past");
  const past = sorted.filter(b => bookingStatus(b) === "past").reverse();

  const openAdd = () => {
    setForm({ type: "van", vanId: vans[0]?.id || "", clientName: "", guests: "2", startDate: "", endDate: "", notes: "", equipmentItems: {}, depositCollected: false });
    setModal("add");
  };
  const openEdit = (b) => {
    if (b.type === "equipment") {
      const eqItems = {};
      b.equipmentItems?.forEach(i => { eqItems[i.id] = i.qty; });
      setForm({ type: "equipment", vanId: "", clientName: b.clientName, guests: "1", startDate: b.startDate, endDate: b.endDate, notes: b.notes || "", equipmentItems: eqItems, depositCollected: b.depositCollected || false });
    } else {
      setForm({ type: "van", vanId: b.vanId || vans[0]?.id || "", clientName: b.clientName, guests: String(b.guests || 2), startDate: b.startDate, endDate: b.endDate, notes: b.notes || "", equipmentItems: {}, depositCollected: false });
    }
    setModal(b.id);
  };
  const save = () => {
    if (!form.clientName.trim() || !form.startDate || !form.endDate) return;
    let data;
    if (form.type === "equipment") {
      const equipmentItems = Object.entries(form.equipmentItems).filter(([, q]) => q > 0).map(([id, qty]) => {
        const cat = equipment.find(e => e.id === id);
        return { id, name: cat?.name || id, icon: cat?.icon || "📦", qty };
      });
      if (!equipmentItems.length) return;
      const depositAmount = equipmentItems.reduce((sum, i) => sum + ((equipment.find(e => e.id === i.id)?.depositAmount || 0) * i.qty), 0);
      const existing = modal !== "add" ? bookings.find(b => b.id === modal) : null;
      data = { type: "equipment", vanId: null, equipmentItems, clientName: form.clientName.trim(), startDate: form.startDate, endDate: form.endDate, notes: form.notes.trim(), depositAmount, depositCollected: form.depositCollected,
        preChecksCompleted: existing?.preChecksCompleted || false, preChecksBy: existing?.preChecksBy || null, preChecksAt: existing?.preChecksAt || null,
        postChecksCompleted: existing?.postChecksCompleted || false, postChecksBy: existing?.postChecksBy || null, postChecksAt: existing?.postChecksAt || null };
    } else {
      if (!form.vanId) return;
      data = { type: "van", vanId: form.vanId, clientName: form.clientName.trim(), guests: parseInt(form.guests) || 1, startDate: form.startDate, endDate: form.endDate, notes: form.notes.trim() };
    }
    if (modal === "add") onUpdate([...bookings, { id: genId(), ...data }]);
    else onUpdate(bookings.map(b => b.id === modal ? { ...b, ...data } : b));
    setModal(null);
  };
  const remove = (id) => onUpdate(bookings.filter(b => b.id !== id));

  const renderCard = (b, dim = false) => {
    const isEq = b.type === "equipment";
    const van = !isEq ? vans.find(v => v.id === b.vanId) : null;
    const status = bookingStatus(b);
    const days = daysUntilStart(b);
    const pillStyle = status === "active" ? { background: "rgba(78,203,113,0.15)", color: "var(--success)" }
      : status === "past" ? { background: "var(--bg2)", color: "var(--text-muted)" }
      : days <= 1 ? { background: "rgba(224,85,85,0.15)", color: "var(--danger)" }
      : days <= 3 ? { background: "rgba(232,185,64,0.15)", color: "var(--warning)" }
      : { background: "var(--bg2)", color: "var(--text-muted)" };
    const pillLabel = status === "active" ? "On rental" : status === "past" ? "Returned"
      : days === 0 ? "Departs today" : days === 1 ? "Tomorrow" : `In ${days} days`;
    return (
      <div key={b.id} className={`booking-card${dim ? " past" : ""}`}>
        <div className="booking-card-top">
          <div className="booking-van">
            <span style={{ fontSize: 22 }}>{isEq ? "📦" : (van?.image || "🚐")}</span>
            <span className="booking-van-name">{isEq ? "Equipment Rental" : (van?.name || "Unknown van")}</span>
            <span className="booking-pill" style={pillStyle}>{pillLabel}</span>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", gap: 6 }}>
              {status !== "past" && !b.preChecksCompleted && <button className="btn btn-secondary btn-sm" onClick={() => openEdit(b)}>Edit</button>}
              <button className="btn btn-danger btn-sm" onClick={() => remove(b.id)}>Remove</button>
            </div>
          )}
        </div>
        <div className="booking-client">{b.clientName}{!isEq && ` · ${b.guests} guest${b.guests !== 1 ? "s" : ""}`}</div>
        {isEq && b.equipmentItems?.length > 0 && (
          <div style={{ fontSize: 13, color: "var(--text-dim)", margin: "4px 0" }}>
            {b.equipmentItems.map(i => `${i.icon} ${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(" · ")}
          </div>
        )}
        <div className="booking-dates">{fmtDate(b.startDate)} → {fmtDate(b.endDate)}</div>
        {isEq && (
          <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: b.preChecksCompleted ? "var(--success)" : "var(--text-muted)", fontWeight: 500 }}>
              {b.preChecksCompleted ? "✓ Pre-check done" : "○ Pre-check pending"}
            </span>
            <span style={{ fontSize: 12, color: b.postChecksCompleted ? "var(--success)" : "var(--text-muted)", fontWeight: 500 }}>
              {b.postChecksCompleted ? "✓ Return checked" : "○ Return pending"}
            </span>
            {b.depositAmount > 0 && (
              <span style={{ fontSize: 12, color: b.depositCollected ? "var(--success)" : "var(--warning)", fontWeight: 500 }}>
                💰 £{b.depositAmount} {b.depositCollected ? "✓ collected" : "not yet collected"}
              </span>
            )}
          </div>
        )}
        {b.notes && <div className="booking-notes">{b.notes}</div>}
        {b.type === "van" && onBookingUpdate && <ComplianceChecks booking={b} onUpdate={onBookingUpdate} />}
      </div>
    );
  };

  const canSave = form.clientName.trim() && form.startDate && form.endDate &&
    (form.type === "van" ? !!form.vanId : Object.values(form.equipmentItems).some(q => q > 0));

  return (
    <div className="content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="section-title" style={{ margin: 0 }}>Upcoming Rentals</div>
        {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Booking</button>}
      </div>
      {upcoming.length === 0
        ? <div className="empty-state">No upcoming rentals. {isAdmin && "Use the button above to add one."}</div>
        : <div className="booking-list" style={{ marginBottom: 24 }}>{upcoming.map(b => renderCard(b))}</div>}
      {past.length > 0 && (
        <>
          <div className="section-title">Past Rentals</div>
          <div className="booking-list">{past.slice(0, 20).map(b => renderCard(b, true))}</div>
        </>
      )}
      {modal && (
        <Modal title={modal === "add" ? "Add Booking" : "Edit Booking"} onClose={() => setModal(null)}>
          <div className="mgmt-field">
            <label className="mgmt-label">Booking Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              <button className={`btn btn-sm ${form.type === "van" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setForm({ ...form, type: "van", vanId: vans[0]?.id || "" })}>🚐 Van Rental</button>
              <button className={`btn btn-sm ${form.type === "equipment" ? "btn-primary" : "btn-secondary"}`}
                onClick={() => setForm({ ...form, type: "equipment", vanId: "" })}>📦 Equipment Only</button>
            </div>
          </div>
          {form.type === "van" ? (
            <>
              <div className="mgmt-field">
                <label className="mgmt-label">Van</label>
                <select className="input" value={form.vanId} onChange={e => setForm({ ...form, vanId: e.target.value })}>
                  {vans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="mgmt-field">
                <label className="mgmt-label">Number of Guests</label>
                <input className="input" value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value.replace(/\D/g, "") })} inputMode="numeric" placeholder="e.g. 2" />
              </div>
            </>
          ) : (
            <div className="mgmt-field">
              <label className="mgmt-label">Equipment Items</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {equipment.map(item => {
                  const qty = form.equipmentItems[item.id] || 0;
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", borderRadius: 8, padding: "10px 12px", border: qty > 0 ? "1px solid var(--accent-dim)" : "1px solid var(--border)" }}>
                      <div>
                        <div style={{ fontSize: 14 }}>{item.icon} {item.name}</div>
                        {item.depositAmount > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>£{item.depositAmount} deposit</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button className="btn btn-secondary btn-sm" style={{ padding: "4px 12px" }} onClick={() => setForm({ ...form, equipmentItems: { ...form.equipmentItems, [item.id]: Math.max(0, qty - 1) } })}>−</button>
                        <span style={{ minWidth: 18, textAlign: "center", fontSize: 16, fontWeight: 600, color: qty > 0 ? "var(--accent)" : "var(--text-muted)" }}>{qty}</span>
                        <button className="btn btn-secondary btn-sm" style={{ padding: "4px 12px" }} onClick={() => setForm({ ...form, equipmentItems: { ...form.equipmentItems, [item.id]: Math.min(item.qty, qty + 1) } })}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mgmt-field">
            <label className="mgmt-label">Client Name</label>
            <input className="input" value={form.clientName} onChange={e => setForm({ ...form, clientName: e.target.value })} placeholder="Full name" />
          </div>
          <div className="mgmt-field">
            <label className="mgmt-label">Departure Date</label>
            <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="mgmt-field">
            <label className="mgmt-label">Return Date</label>
            <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
          </div>
          {form.type === "equipment" && (
            <div className="cl-item" style={{ padding: "8px 0", marginBottom: 8, userSelect: "none" }} onClick={() => setForm({ ...form, depositCollected: !form.depositCollected })}>
              <div className={`cl-checkbox ${form.depositCollected ? "checked" : ""}`}>{form.depositCollected && "✓"}</div>
              <span className="cl-item-text">Deposit collected at booking</span>
            </div>
          )}
          <div className="mgmt-field">
            <label className="mgmt-label">Notes (optional)</label>
            <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="e.g. collecting at 9am" />
          </div>
          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={save} disabled={!canSave}>
              {modal === "add" ? "Add Booking" : "Save Changes"}
            </button>
            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Equipment Rentals ──────────────────────────────────────────
function EquipmentPanel({ equipment, onEquipmentChange, rentals, onRentalsChange, user, isAdmin, addLog, showToast, catalogueOnly = false, hideCatalogueBtn = false }) {
  const [view, setView] = useState(catalogueOnly ? "catalog" : "list"); // list | new | returning | catalog
  const [newStep, setNewStep] = useState(0); // 0=select 1=prechecks 2=customer
  const [returnStep, setReturnStep] = useState(0); // 0=postchecks 1=confirm
  const [returningId, setReturningId] = useState(null);

  // new rental state
  const [selectedItems, setSelectedItems] = useState([]);
  const [preChecks, setPreChecks] = useState({});
  const [preNotes, setPreNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [eqPhotoCount, setEqPhotoCount] = useState(0);
  const [contractTaken, setContractTaken] = useState(false);
  const [depositAmt, setDepositAmt] = useState("");
  const [depositCollected, setDepositCollected] = useState(false);

  // return state
  const [postChecks, setPostChecks] = useState({});
  const [postNotes, setPostNotes] = useState("");
  const [depositReturned, setDepositReturned] = useState(null);

  // catalog editing state
  const [catalogModal, setCatalogModal] = useState(null);
  const [catForm, setCatForm] = useState({ name: "", icon: "📦", qty: "1", depositAmount: "" });
  const [editChecks, setEditChecks] = useState({ pre: [], post: [] });
  const [newCheckTxt, setNewCheckTxt] = useState({ pre: "", post: "" });

  const activeRentals = rentals.filter(r => r.status === "out");
  const pastRentals = rentals.filter(r => r.status === "returned");
  const returningRental = returningId ? rentals.find(r => r.id === returningId) : null;

  const selectedEquipment = selectedItems.map(si => equipment.find(e => e.id === si.id)).filter(Boolean);
  const calcDeposit = selectedEquipment.reduce((s, e) => s + (e.depositAmount || 0), 0);

  const preCheckKeys = selectedEquipment.flatMap(e => e.preChecks.map(c => `${e.id}__${c.id}`));
  const preCheckedCount = preCheckKeys.filter(k => { const [ei, ci] = k.split("__"); return preChecks[ei]?.[ci]; }).length;
  const preAllDone = preCheckKeys.length > 0 && preCheckedCount === preCheckKeys.length;

  const postCheckKeys = returningRental
    ? returningRental.items.flatMap(item => { const eq = equipment.find(e => e.id === item.id); return (eq?.postChecks || []).map(c => `${item.id}__${c.id}`); })
    : [];
  const postCheckedCount = postCheckKeys.filter(k => { const [ei, ci] = k.split("__"); return postChecks[ei]?.[ci]; }).length;
  const postAllDone = postCheckKeys.length > 0 && postCheckedCount === postCheckKeys.length;

  const togglePre = (eId, cId) => setPreChecks(p => ({ ...p, [eId]: { ...(p[eId] || {}), [cId]: !(p[eId]?.[cId]) } }));
  const togglePost = (eId, cId) => setPostChecks(p => ({ ...p, [eId]: { ...(p[eId] || {}), [cId]: !(p[eId]?.[cId]) } }));

  const resetNew = () => { setSelectedItems([]); setPreChecks({}); setPreNotes(""); setCustomerName(""); setReturnDate(""); setEqPhotoCount(0); setContractTaken(false); setDepositAmt(""); setDepositCollected(false); setNewStep(0); };
  const resetReturn = () => { setPostChecks({}); setPostNotes(""); setDepositReturned(null); setReturnStep(0); setReturningId(null); };

  const completeRental = () => {
    if (!customerName.trim()) return;
    const r = {
      id: genId(), items: selectedEquipment.map(e => ({ id: e.id, name: e.name, icon: e.icon, depositAmount: e.depositAmount })),
      preChecks, postChecks: {}, preNotes, customerName: customerName.trim(), returnDate,
      eqPhotoCount, contractTaken, depositAmount: depositAmt ? parseInt(depositAmt) : calcDeposit,
      depositCollected, depositReturned: null, postNotes: "", status: "out",
      by: user.name, createdAt: new Date().toISOString(), returnedAt: null, returnedBy: null,
    };
    onRentalsChange([r, ...rentals]);
    addLog(`created equipment rental for ${r.customerName}`);
    showToast("Equipment rental created");
    resetNew(); setView("list");
  };

  const completeReturn = () => {
    if (!returningRental) return;
    onRentalsChange(rentals.map(r => r.id === returningRental.id ? {
      ...r, postChecks, postNotes, depositReturned, status: "returned",
      returnedAt: new Date().toISOString(), returnedBy: user.name,
    } : r));
    addLog(`processed equipment return for ${returningRental.customerName}`);
    showToast("Return processed");
    resetReturn(); setView("list");
  };

  // catalog helpers
  const addCheck = (phase) => {
    const t = newCheckTxt[phase].trim(); if (!t) return;
    setEditChecks(p => ({ ...p, [phase]: [...p[phase], { id: genId(), label: t }] }));
    setNewCheckTxt(p => ({ ...p, [phase]: "" }));
  };
  const removeCheck = (phase, id) => setEditChecks(p => ({ ...p, [phase]: p[phase].filter(c => c.id !== id) }));
  const saveCatalog = () => {
    if (!catForm.name.trim()) return;
    const item = { name: catForm.name.trim(), icon: catForm.icon || "📦", qty: parseInt(catForm.qty) || 1, depositAmount: parseInt(catForm.depositAmount) || 0, preChecks: editChecks.pre, postChecks: editChecks.post };
    if (catalogModal === "add") onEquipmentChange([...equipment, { id: genId(), ...item }]);
    else onEquipmentChange(equipment.map(e => e.id === catalogModal ? { ...e, ...item } : e));
    setCatalogModal(null);
  };

  // ── Catalog view ──
  if (view === "catalog") return (
    <div className="content">
      {!catalogueOnly && <button className="back-btn" onClick={() => setView("list")}>← Back to Equipment</button>}
      <div className="section-title">Equipment Catalogue</div>
      <div className="mgmt-grid">
        {equipment.map(item => (
          <div key={item.id} className="mgmt-card">
            <div className="mgmt-card-header"><span className="mgmt-card-name">{item.icon} {item.name}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Stock</span><span style={{ fontSize: 14 }}>{item.qty}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Deposit</span><span style={{ fontSize: 14 }}>£{item.depositAmount}</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Pre-rental checks</span><span style={{ fontSize: 13, color: "var(--text-dim)" }}>{item.preChecks.length} tasks</span></div>
            <div className="mgmt-field"><span className="mgmt-label">Post-return checks</span><span style={{ fontSize: 13, color: "var(--text-dim)" }}>{item.postChecks.length} tasks</span></div>
            <div className="btn-row">
              <button className="btn btn-secondary btn-sm" onClick={() => { setCatForm({ name: item.name, icon: item.icon, qty: String(item.qty), depositAmount: String(item.depositAmount) }); setEditChecks({ pre: [...item.preChecks], post: [...item.postChecks] }); setNewCheckTxt({ pre: "", post: "" }); setCatalogModal(item.id); }}>Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => onEquipmentChange(equipment.filter(e => e.id !== item.id))}>Remove</button>
            </div>
          </div>
        ))}
        <div className="add-card" onClick={() => { setCatForm({ name: "", icon: "📦", qty: "1", depositAmount: "" }); setEditChecks({ pre: [], post: [] }); setNewCheckTxt({ pre: "", post: "" }); setCatalogModal("add"); }}><span className="plus">+</span><span>Add Equipment</span></div>
      </div>
      {catalogModal !== null && (
        <Modal title={catalogModal === "add" ? "Add Equipment" : "Edit Equipment"} onClose={() => setCatalogModal(null)}>
          <div className="mgmt-field"><label className="mgmt-label">Name</label><input className="input" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sleeping Bag" /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="mgmt-field" style={{ flex: 1 }}><label className="mgmt-label">Icon</label><input className="input" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} /></div>
            <div className="mgmt-field" style={{ flex: 1 }}><label className="mgmt-label">Stock</label><input className="input" value={catForm.qty} onChange={e => setCatForm(f => ({ ...f, qty: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" /></div>
            <div className="mgmt-field" style={{ flex: 1 }}><label className="mgmt-label">Deposit £</label><input className="input" value={catForm.depositAmount} onChange={e => setCatForm(f => ({ ...f, depositAmount: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" /></div>
          </div>
          {["pre", "post"].map(phase => (
            <div key={phase} style={{ marginTop: 16 }}>
              <div className="mgmt-label" style={{ marginBottom: 8 }}>{phase === "pre" ? "Pre-rental checks" : "Post-return checks"}</div>
              {editChecks[phase].map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 13, flex: 1, color: "var(--text-dim)" }}>{c.label}</span>
                  <button className="btn btn-danger btn-sm" style={{ padding: "2px 8px" }} onClick={() => removeCheck(phase, c.id)}>×</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <input className="input" style={{ fontSize: 13 }} value={newCheckTxt[phase]} onChange={e => setNewCheckTxt(p => ({ ...p, [phase]: e.target.value }))} placeholder={phase === "pre" ? "Add pre-rental task..." : "Add post-return task..."} onKeyDown={e => e.key === "Enter" && addCheck(phase)} />
                <button className="btn btn-secondary btn-sm" onClick={() => addCheck(phase)}>Add</button>
              </div>
            </div>
          ))}
          <div className="btn-row" style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveCatalog} disabled={!catForm.name.trim()}>{catalogModal === "add" ? "Add Item" : "Save Changes"}</button>
            <button className="btn btn-secondary" onClick={() => setCatalogModal(null)}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );

  // ── New rental — step 0: select items ──
  if (view === "new" && newStep === 0) return (
    <div className="content">
      <button className="back-btn" onClick={() => { resetNew(); setView("list"); }}>← Back</button>
      <StepProgress current={0} total={3} />
      <div className="section-title">Select Equipment to Rent Out</div>
      {equipment.length === 0 ? (
        <div className="empty-state">No equipment in catalogue.{isAdmin && " Add items via Manage Catalogue."}</div>
      ) : (
        <div className="cl-sections">
          {equipment.map(item => {
            const isSel = selectedItems.some(si => si.id === item.id);
            return (
              <div key={item.id} className="cl-section" style={{ border: isSel ? "2px solid var(--accent-dim)" : undefined }} onClick={() => setSelectedItems(p => isSel ? p.filter(si => si.id !== item.id) : [...p, { id: item.id }])}>
                <div className="cl-section-header">
                  <div className="cl-section-left">
                    <span className="cl-section-icon">{item.icon}</span>
                    <div><div className="cl-section-name">{item.name}</div><div className="cl-section-count">Deposit £{item.depositAmount} · {item.preChecks.length} pre-checks</div></div>
                  </div>
                  <div className={`cl-checkbox ${isSel ? "checked" : ""}`} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 18, flexShrink: 0 }}>{isSel && "✓"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selectedItems.length > 0 && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} selected</div><div style={{ fontSize: 13, color: "var(--text-dim)" }}>Total deposit: £{calcDeposit}</div></div>
          <button className="btn btn-primary" onClick={() => setNewStep(1)}>Pre-rental Checks →</button>
        </div>
      )}
    </div>
  );

  // ── New rental — step 1: pre-rental checks ──
  if (view === "new" && newStep === 1) return (
    <div className="content">
      <button className="back-btn" onClick={() => setNewStep(0)}>← Back</button>
      <StepProgress current={1} total={3} />
      <div className="cl-progress">
        <span className="cl-progress-text">Pre-rental checks</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${preCheckKeys.length > 0 ? Math.round((preCheckedCount / preCheckKeys.length) * 100) : 0}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{preCheckKeys.length > 0 ? Math.round((preCheckedCount / preCheckKeys.length) * 100) : 0}%</span></span>
      </div>
      <div className="cl-sections">
        {selectedEquipment.map(item => {
          const done = item.preChecks.filter(c => preChecks[item.id]?.[c.id]).length;
          const badge = done === item.preChecks.length && item.preChecks.length > 0 ? "complete" : done > 0 ? "partial" : "empty";
          return (
            <div key={item.id} className="cl-section">
              <div className="cl-section-header">
                <div className="cl-section-left"><span className="cl-section-icon">{item.icon}</span><div><div className="cl-section-name">{item.name}</div><div className="cl-section-count">{done} of {item.preChecks.length} complete</div></div></div>
                <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
              </div>
              {item.preChecks.length === 0
                ? <div className="cl-items"><div style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No pre-checks defined for this item</div></div>
                : <div className="cl-items">{item.preChecks.map(c => { const ck = preChecks[item.id]?.[c.id]; return (<div key={c.id} className="cl-item" onClick={() => togglePre(item.id, c.id)}><div className={`cl-checkbox ${ck ? "checked" : ""}`}>{ck && "✓"}</div><span className={`cl-item-text ${ck ? "done" : ""}`}>{c.label}</span></div>); })}</div>
              }
            </div>
          );
        })}
      </div>
      <div className="mgmt-field" style={{ marginTop: 16 }}><label className="mgmt-label">Notes (optional)</label><input className="input" value={preNotes} onChange={e => setPreNotes(e.target.value)} placeholder="Any issues found during pre-check..." /></div>
      <div className="cl-actions">
        <button className="btn btn-primary" disabled={!preAllDone} onClick={() => setNewStep(2)}>{preAllDone ? "Continue to Customer Details →" : `${preCheckKeys.length - preCheckedCount} checks remaining`}</button>
      </div>
    </div>
  );

  // ── New rental — step 2: customer, photos, deposit ──
  if (view === "new" && newStep === 2) return (
    <div className="content">
      <button className="back-btn" onClick={() => setNewStep(1)}>← Back</button>
      <StepProgress current={2} total={3} />
      <div className="section-title">Equipment Photo</div>
      <label style={{ display: "block" }}>
        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={() => setEqPhotoCount(c => c + 1)} />
        <div className={`photo-btn ${eqPhotoCount > 0 ? "has-photos" : ""}`} style={{ width: "100%", justifyContent: "center", padding: 16, marginBottom: 0 }}>
          📷 {eqPhotoCount > 0 ? `${eqPhotoCount} photo${eqPhotoCount !== 1 ? "s" : ""} taken — tap to add more` : "Photograph all equipment laid out together"}
        </div>
      </label>
      <div style={{ fontSize: 12, color: "var(--text-muted)", margin: "6px 0 20px", textAlign: "center" }}>Lay out every item being rented before photographing</div>
      <div className="section-title">Customer Details</div>
      <div className="mgmt-field"><label className="mgmt-label">Customer Name</label><input className="input" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name" /></div>
      <div className="mgmt-field"><label className="mgmt-label">Expected Return Date</label><input className="input" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} /></div>
      <div className="section-title" style={{ marginTop: 20 }}>Contract</div>
      <label style={{ display: "block" }}>
        <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={() => setContractTaken(true)} />
        <div className={`photo-btn ${contractTaken ? "has-photos" : ""}`} style={{ width: "100%", justifyContent: "center", padding: 16 }}>
          {contractTaken ? "✓ Contract photo taken — tap to retake" : "📋 Photograph signed rental contract"}
        </div>
      </label>
      <div className="section-title" style={{ marginTop: 20 }}>Deposit</div>
      <div className="mgmt-field"><label className="mgmt-label">Deposit amount (£)</label><input className="input" value={depositAmt !== "" ? depositAmt : calcDeposit} onChange={e => setDepositAmt(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div>
      <div className="cl-item" style={{ padding: "12px 0", cursor: "pointer" }} onClick={() => setDepositCollected(p => !p)}>
        <div className={`cl-checkbox ${depositCollected ? "checked" : ""}`} style={{ width: 28, height: 28 }}>{depositCollected && "✓"}</div>
        <span className="cl-item-text">Deposit collected from customer</span>
      </div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px", margin: "20px 0", fontSize: 13 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Rental summary</div>
        {selectedEquipment.map(e => (<div key={e.id} style={{ display: "flex", justifyContent: "space-between", color: "var(--text-dim)", marginBottom: 4 }}><span>{e.icon} {e.name}</span><span>£{e.depositAmount}</span></div>))}
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text)" }}><span>Total deposit</span><span>£{depositAmt !== "" ? depositAmt : calcDeposit}</span></div>
      </div>
      <div className="cl-actions"><button className="btn btn-primary" disabled={!customerName.trim()} onClick={completeRental}>Complete Rental</button></div>
    </div>
  );

  // ── Return — step 0: post-return checks ──
  if (view === "returning" && returningRental && returnStep === 0) return (
    <div className="content">
      <button className="back-btn" onClick={() => { resetReturn(); setView("list"); }}>← Back</button>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Return — {returningRental.customerName}</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>{returningRental.items.map(i => `${i.icon} ${i.name}`).join(", ")}</div>
        {returningRental.returnDate && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Expected return: {fmtDate(returningRental.returnDate)}</div>}
      </div>
      <div className="cl-progress">
        <span className="cl-progress-text">Post-return checks</span>
        <div className="cl-progress-bar-bg"><div className="cl-progress-bar" style={{ width: `${postCheckKeys.length > 0 ? Math.round((postCheckedCount / postCheckKeys.length) * 100) : 0}%` }} /></div>
        <span className="cl-progress-text"><span className="cl-progress-pct">{postCheckKeys.length > 0 ? Math.round((postCheckedCount / postCheckKeys.length) * 100) : 0}%</span></span>
      </div>
      <div className="cl-sections">
        {returningRental.items.map(item => {
          const eq = equipment.find(e => e.id === item.id);
          const checks = eq?.postChecks || [];
          const done = checks.filter(c => postChecks[item.id]?.[c.id]).length;
          const badge = done === checks.length && checks.length > 0 ? "complete" : done > 0 ? "partial" : "empty";
          return (
            <div key={item.id} className="cl-section">
              <div className="cl-section-header">
                <div className="cl-section-left"><span className="cl-section-icon">{item.icon}</span><div><div className="cl-section-name">{item.name}</div><div className="cl-section-count">{done} of {checks.length} complete</div></div></div>
                <span className={`cl-section-badge ${badge}`}>{badge === "complete" ? "✓ Done" : badge === "partial" ? "In progress" : "Not started"}</span>
              </div>
              {checks.length === 0
                ? <div className="cl-items"><div style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>No post-checks defined</div></div>
                : <div className="cl-items">{checks.map(c => { const ck = postChecks[item.id]?.[c.id]; return (<div key={c.id} className="cl-item" onClick={() => togglePost(item.id, c.id)}><div className={`cl-checkbox ${ck ? "checked" : ""}`}>{ck && "✓"}</div><span className={`cl-item-text ${ck ? "done" : ""}`}>{c.label}</span></div>); })}</div>
              }
            </div>
          );
        })}
      </div>
      <div className="mgmt-field" style={{ marginTop: 16 }}><label className="mgmt-label">Issues or damage noted</label><textarea className="textarea" value={postNotes} onChange={e => setPostNotes(e.target.value)} placeholder="Note any damage, missing items or condition issues..." /></div>
      <div className="cl-actions">
        <button className="btn btn-primary" disabled={!postAllDone} onClick={() => setReturnStep(1)}>{postAllDone ? "Continue →" : `${postCheckKeys.length - postCheckedCount} checks remaining`}</button>
      </div>
    </div>
  );

  // ── Return — step 1: deposit + confirm ──
  if (view === "returning" && returningRental && returnStep === 1) return (
    <div className="content">
      <button className="back-btn" onClick={() => setReturnStep(0)}>← Back</button>
      <div className="cl-complete-banner" style={{ marginBottom: 20 }}>
        <h3>Post-return checks complete</h3>
        <p>{returningRental.items.length} item{returningRental.items.length !== 1 ? "s" : ""} checked in for {returningRental.customerName}</p>
      </div>
      <div className="section-title">Deposit Decision</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {[{ value: true, label: "Return deposit to customer", sub: `Refund £${returningRental.depositAmount}` },
          { value: false, label: "Retain deposit", sub: "Due to damage or items not returned" }].map(opt => (
          <div key={String(opt.value)} className="cl-item" style={{ padding: "14px 16px", cursor: "pointer", background: "var(--card)", border: depositReturned === opt.value ? "2px solid var(--accent)" : "1px solid var(--border)", borderRadius: "var(--radius-sm)" }}
            onClick={() => setDepositReturned(opt.value)}>
            <div className={`cl-checkbox ${depositReturned === opt.value ? "checked" : ""}`} style={{ width: 28, height: 28 }}>{depositReturned === opt.value && "✓"}</div>
            <div><div style={{ fontWeight: 500 }}>{opt.label}</div><div style={{ fontSize: 13, color: "var(--text-dim)" }}>{opt.sub}</div></div>
          </div>
        ))}
      </div>
      <div className="cl-actions"><button className="btn btn-primary" disabled={depositReturned === null} onClick={completeReturn}>Complete Return</button></div>
    </div>
  );

  // ── List view (default) ──
  return (
    <div className="content">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div className="section-title" style={{ margin: 0 }}>Equipment Rentals</div>
        <div style={{ display: "flex", gap: 8 }}>
          {isAdmin && !hideCatalogueBtn && <button className="btn btn-secondary btn-sm" onClick={() => setView("catalog")}>Manage Catalogue</button>}
          <button className="btn btn-primary btn-sm" onClick={() => { resetNew(); setView("new"); }}>+ New Rental</button>
        </div>
      </div>
      {activeRentals.length > 0 && (
        <>
          <div className="section-title">Active Rentals</div>
          {activeRentals.map(r => (
            <div key={r.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div><div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{r.customerName}</div><div style={{ fontSize: 13, color: "var(--text-dim)" }}>{r.items.map(i => `${i.icon} ${i.name}`).join(", ")}</div></div>
                <span className="status-badge" style={{ background: "rgba(78,203,113,0.15)", color: "var(--success)" }}><span className="status-dot" style={{ background: "var(--success)" }} />Out</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                <span>Rented out {fmtDate(r.createdAt)} by {r.by}</span>
                {r.returnDate && <span>Due back {fmtDate(r.returnDate)}</span>}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                <span style={{ color: r.depositCollected ? "var(--success)" : "var(--warning)" }}>{r.depositCollected ? `✓ Deposit collected £${r.depositAmount}` : "⚠ Deposit not collected"}</span>
                <button className="btn btn-primary btn-sm" onClick={() => { setReturningId(r.id); setPostChecks({}); setPostNotes(""); setDepositReturned(null); setReturnStep(0); setView("returning"); }}>Process Return</button>
              </div>
            </div>
          ))}
        </>
      )}
      {activeRentals.length === 0 && pastRentals.length === 0 && <div className="empty-state">No equipment rentals yet. Tap + New Rental to begin.</div>}
      {pastRentals.length > 0 && (
        <>
          <div className="section-title" style={{ marginTop: 24 }}>Past Rentals</div>
          {pastRentals.slice(0, 10).map(r => (
            <div key={r.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 12, opacity: 0.75 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{r.customerName}</div><div style={{ fontSize: 13, color: "var(--text-dim)" }}>{r.items.map(i => `${i.icon} ${i.name}`).join(", ")}</div></div>
                <span className="status-badge" style={{ background: "var(--bg2)", color: "var(--text-muted)" }}>Returned</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {fmtDate(r.createdAt)} → {fmtDate(r.returnedAt)} · {r.returnedBy}
                {r.depositReturned === true && " · Deposit returned"}{r.depositReturned === false && " · Deposit retained"}
              </div>
              {r.postNotes && <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6, fontStyle: "italic" }}>{r.postNotes}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState(() => {
    try { const s = localStorage.getItem("se_current_user"); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [pinTarget, setPinTarget] = useState(null);
  const [tab, setTab] = useState("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [vans, setVans] = useState(DEFAULT_VANS);
  const [logs, setLogs] = useState([]);
  const [templates, setTemplates] = useState(DEFAULT_TEMPLATES);
  const [postTripTemplates, setPostTripTemplates] = useState(DEFAULT_POST_TRIP_TEMPLATES);
  const [handoverTemplates, setHandoverTemplates] = useState(DEFAULT_HANDOVER_TEMPLATES);
  const [bookings, setBookings] = useState([]);
  const [equipment, setEquipment] = useState(DEFAULT_EQUIPMENT);
  const [preDepartureProgress, setPreDepartureProgress] = useState({});
  const [handoverProgress, setHandoverProgress] = useState({});
  const [postTripProgress, setPostTripProgress] = useState({});

  useEffect(() => {
    (async () => {
      try {
        await ensureSignedIn();
        const [teamData, vansData, bookingsData, equipmentData, logsData, predepData, handoverData, postTripData] = await Promise.all([
          db.getTeam(), db.getVans(), db.getBookings(), db.getEquipment(), db.getLogs(),
          db.getPredepProgress(), db.getHandoverProgress(), db.getPostTripProgress(),
        ]);
        const tp  = await store.get("se_templates", DEFAULT_TEMPLATES);
        const ptp = await store.get("se_post_trip_templates", DEFAULT_POST_TRIP_TEMPLATES);
        const ht  = await store.get("se_handover_templates", DEFAULT_HANDOVER_TEMPLATES);
        setTeam(teamData.length ? teamData : DEFAULT_TEAM);
        setVans(vansData.length ? vansData : DEFAULT_VANS);
        setBookings(bookingsData);
        setEquipment(equipmentData.length ? equipmentData : DEFAULT_EQUIPMENT);
        setLogs(logsData);
        setPreDepartureProgress(predepData);
        setHandoverProgress(handoverData);
        setPostTripProgress(postTripData);
        setTemplates(tp);
        setPostTripTemplates(ptp);
        setHandoverTemplates(ht);
      } catch (err) {
        console.error("Supabase load failed, falling back to localStorage:", err);
        const t   = await store.get("se_team", DEFAULT_TEAM);
        const v   = await store.get("se_vans", DEFAULT_VANS);
        const l   = await store.get("se_logs", []);
        const tp  = await store.get("se_templates", DEFAULT_TEMPLATES);
        const ptp = await store.get("se_post_trip_templates", DEFAULT_POST_TRIP_TEMPLATES);
        const ht  = await store.get("se_handover_templates", DEFAULT_HANDOVER_TEMPLATES);
        const bk  = await store.get("se_bookings", []);
        const eq  = await store.get("se_equipment", DEFAULT_EQUIPMENT);
        const pdp = await store.get("se_predep_progress", {});
        setTeam(t); setVans(v); setLogs(l); setTemplates(tp); setPostTripTemplates(ptp); setHandoverTemplates(ht);
        setBookings(bk); setEquipment(eq); setPreDepartureProgress(pdp);
      }
      setLoaded(true);
    })();
  }, []);

  // Templates stay in localStorage (rarely change, device-level config for now)
  useEffect(() => { if (loaded) store.set("se_templates", templates); }, [templates, loaded]);
  useEffect(() => { if (loaded) store.set("se_post_trip_templates", postTripTemplates); }, [postTripTemplates, loaded]);
  useEffect(() => { if (loaded) store.set("se_handover_templates", handoverTemplates); }, [handoverTemplates, loaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };
  const persistVans = (newVans) => {
    setVans(newVans);
    db.saveVans(newVans).catch(err => showToast(`Couldn't save van — ${err.message}`));
  };
  const addLog = useCallback((action, vanName) => {
    if (!user) return;
    const entry = { who: user.name, action, van: vanName || "", date: new Date().toISOString() };
    setLogs(prev => [entry, ...prev.slice(0, 49)]);
    db.addLog(entry);
  }, [user]);

  const handleLogin = (m) => { setUser(m); setPinTarget(null); localStorage.setItem("se_current_user", JSON.stringify(m)); showToast(`Welcome back, ${m.name}`); };
  const handleStatusChange = (vanId, s) => {
    persistVans(vans.map(v => v.id === vanId ? { ...v, status: s } : v));
    addLog(`set status to ${statusLabel[s]}`, vans.find(v => v.id === vanId)?.name);
    showToast("Status updated");
  };
  const handleBookingUpdate = (id, updates) => {
    setBookings(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      const changed = next.find(b => b.id === id);
      if (changed) db.upsertBooking(changed).catch(err => showToast(`Couldn't save booking — ${err.message}`));
      return next;
    });
  };

  // Bookings: detect adds/edits/deletes and sync to Supabase
  const handleBookingsUpdate = (newBookings) => {
    const newMap = new Map(newBookings.map(b => [b.id, b]));
    const oldMap = new Map(bookings.map(b => [b.id, b]));
    // Deletions
    bookings.forEach(b => { if (!newMap.has(b.id)) db.deleteBooking(b.id); });
    // Additions and edits
    newBookings.forEach(b => {
      const old = oldMap.get(b.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(b)) {
        db.upsertBooking(b).catch(err => showToast(`Couldn't save booking — ${err.message}`));
      }
    });
    setBookings(newBookings);
    showToast("Bookings updated");
  };

  // Equipment: detect adds/edits/deletes and sync to Supabase
  const handleEquipmentUpdate = (newEquipment) => {
    const newMap = new Map(newEquipment.map(e => [e.id, e]));
    // Deletions
    equipment.forEach(e => { if (!newMap.has(e.id)) db.deleteEquipment(e.id); });
    // Additions and edits
    newEquipment.forEach(e => {
      const old = equipment.find(x => x.id === e.id);
      if (!old || JSON.stringify(old) !== JSON.stringify(e)) db.upsertEquipment(e);
    });
    setEquipment(newEquipment);
    showToast("Catalogue updated");
  };

  // Team: upsert all, soft-delete removed members
  const handleTeamUpdate = (newTeam) => {
    const newIds = new Set(newTeam.map(m => m.id));
    team.forEach(m => { if (!newIds.has(m.id)) db.softDeleteTeamMember(m.id); });
    db.saveTeam(newTeam);
    setTeam(newTeam);
    showToast("Team updated");
  };

  // Attach a completed check to the right booking for this van.
  // Pre-dep + handover: prefer the next not-yet-started booking; fall back to a
  //   currently active booking when none. Skip already-ended bookings.
  // Post-trip: most recently ended (or still active) booking missing post-trip.
  const recordRentalCheck = (vanId, checkType, payload) => {
    const todayD = new Date(); todayD.setHours(0, 0, 0, 0);
    const startOf = b => { const s = new Date(b.startDate); s.setHours(0, 0, 0, 0); return s; };
    const endOf   = b => { const e = new Date(b.endDate);   e.setHours(0, 0, 0, 0); return e; };
    const vanBookings = bookings.filter(b => b.type === "van" && b.vanId === vanId);

    let target;
    if (checkType === "post_trip") {
      target = [...vanBookings]
        .filter(b => !b.rentalChecks?.post_trip)
        .sort((a, b) => endOf(b) - endOf(a))[0];
    } else {
      const missing = vanBookings.filter(b => !b.rentalChecks?.[checkType]);
      target = [...missing]
        .filter(b => startOf(b) >= todayD)
        .sort((a, b) => startOf(a) - startOf(b))[0];
      if (!target) target = [...missing]
        .filter(b => startOf(b) <= todayD && endOf(b) >= todayD)
        .sort((a, b) => endOf(a) - endOf(b))[0];
    }
    if (!target) {
      showToast("No upcoming or active rental — check saved on van but not attached");
      return;
    }
    handleBookingUpdate(target.id, {
      rentalChecks: { ...(target.rentalChecks || {}), [checkType]: payload },
    });
  };

  const handlePreDepartureComplete = (vanId, byName, notes, tyreData, checked) => {
    const now = new Date().toISOString();
    persistVans(vans.map(v => v.id === vanId ? { ...v, lastPreDeparture: { by: byName, date: now, notes, tyreData }, status: "available" } : v));
    setPreDepartureProgress(prev => { const n = { ...prev }; delete n[vanId]; return n; });
    recordRentalCheck(vanId, "pre_departure", { by: byName, date: now, notes, tyreData: tyreData || {}, checked: checked || {} });
    addLog("completed pre-departure check", vans.find(v => v.id === vanId)?.name);
    showToast(`Pre-departure complete for ${vans.find(v => v.id === vanId)?.name}`);
    setTab("dashboard");
  };
  const handleHandoverComplete = (vanId, byName, customerName, licenceNumber, depositCollected, docsDone, checked, sectionNotes, damageMarks, signatureDataUrl) => {
    const now = new Date().toISOString();
    const vanName = vans.find(v => v.id === vanId)?.name;
    persistVans(vans.map(v => v.id === vanId ? { ...v, status: "on_rental" } : v));
    recordRentalCheck(vanId, "handover", {
      by: byName, date: now, customerName, licenceNumber, depositCollected,
      docsDone: docsDone || {}, checked: checked || {}, sectionNotes: sectionNotes || {},
      damageMarks: damageMarks || [], signatureDataUrl: signatureDataUrl || "",
    });
    addLog(`completed handover for ${customerName}`, vanName);
    showToast(`Handover complete — ${vanName} is now on rental`);
    setTab("dashboard");
  };
  const handlePostTripComplete = (vanId, byName, returnInfo, sectionNotes, tyreData, checked, photosMap) => {
    const now = new Date().toISOString();
    const vanName = vans.find(v => v.id === vanId)?.name;
    persistVans(vans.map(v => v.id === vanId ? {
      ...v,
      lastPostTrip: { by: byName, date: now, mileage: returnInfo.mileage, tyreData: tyreData || {} },
      mileage: returnInfo.mileage ? parseInt(returnInfo.mileage) : v.mileage,
      status: "in_prep",
    } : v));
    recordRentalCheck(vanId, "post_trip", {
      by: byName, date: now, returnInfo: returnInfo || {},
      sectionNotes: sectionNotes || {}, tyreData: tyreData || {},
      checked: checked || {}, photosMap: photosMap || {},
    });
    // End of rental cycle — wipe both handover and post-trip progress for this van
    setHandoverProgress(prev => { const n = { ...prev }; delete n[vanId]; return n; });
    setPostTripProgress(prev => { const n = { ...prev }; delete n[vanId]; return n; });
    db.saveHandoverProgress(vanId, null).catch(err => console.error(err));
    db.savePostTripProgress(vanId, null).catch(err => console.error(err));
    addLog("completed post-trip check", vanName);
    const miStr = returnInfo.mileage ? ` · ${parseInt(returnInfo.mileage).toLocaleString()} mi` : "";
    showToast(`Post-trip complete — ${vanName} is In Prep${miStr}`);
    setTab("dashboard");
  };

  const handleHandoverProgressChange = (vanId, data) => {
    setHandoverProgress(prev => data === null ? (({ [vanId]: _, ...rest }) => rest)(prev) : { ...prev, [vanId]: data });
    db.saveHandoverProgress(vanId, data).catch(err => showToast(`Couldn't save handover progress — ${err.message}`));
  };
  const handlePostTripProgressChange = (vanId, data) => {
    setPostTripProgress(prev => data === null ? (({ [vanId]: _, ...rest }) => rest)(prev) : { ...prev, [vanId]: data });
    db.savePostTripProgress(vanId, data).catch(err => showToast(`Couldn't save post-trip progress — ${err.message}`));
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

  const tabs = [
    { id: "dashboard",     label: "Dashboard",    icon: "🏠" },
    { id: "bookings",      label: "Bookings",     icon: "📅" },
    { id: "pre_departure", label: "Pre-departure", icon: "✅" },
    { id: "handover",      label: "Handover",     icon: "🔑" },
    { id: "post_trip",     label: "Post-trip",    icon: "🔍" },
    { id: "team",          label: "Team",         icon: "👥" },
    { id: "vans",          label: "Vans",         icon: "🚐" },
    { id: "equipment",     label: "Equipment",    icon: "🎒" },
  ];

  return (
    <div className="app"><style>{css}</style>
      <div className="header">
        <span className="header-brand">Scotland Escape</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="header-user"><div className="header-avatar">{user.name[0]}</div><span className="header-user-name">{user.name}</span></div>
          <button className="logout-btn" onClick={() => { setUser(null); setTab("dashboard"); setMenuOpen(false); localStorage.removeItem("se_current_user"); }}>Sign out</button>
          <button className={`hamburger${menuOpen ? " open" : ""}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">{menuOpen ? "✕" : "☰"}</button>
        </div>
      </div>
      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        {tabs.map(t => (
          <button key={t.id} className={`mobile-menu-btn${tab === t.id ? " active" : ""}`} onClick={() => { setTab(t.id); setMenuOpen(false); }}>
            <span className="mobile-menu-icon">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="nav">{tabs.map(t => <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
      {tab === "dashboard" && <Dashboard vans={vans} logs={logs} bookings={bookings} onSetStatus={handleStatusChange} preDepartureProgress={preDepartureProgress} templates={templates} handoverTemplates={handoverTemplates} postTripTemplates={postTripTemplates} />}
      {tab === "bookings" && <BookingsPanel vans={vans} bookings={bookings} onUpdate={handleBookingsUpdate} onBookingUpdate={handleBookingUpdate} isAdmin={user.role === "admin"} equipment={equipment} />}
      {tab === "team" && <TeamPanel team={team} onUpdate={handleTeamUpdate} currentUser={user} />}
      {tab === "vans" && <VanPanel vans={vans} onUpdate={v => { persistVans(v); showToast("Fleet updated"); }} currentUser={user} />}
      {tab === "pre_departure" && <PreDeparturePanel vans={vans} templates={templates} onTemplatesChange={t => { setTemplates(t); showToast("Checklist updated"); }} user={user} onComplete={handlePreDepartureComplete} isAdmin={user.role === "admin"} savedProgress={preDepartureProgress} onProgressChange={(vanId, data) => { setPreDepartureProgress(prev => data === null ? (({ [vanId]: _, ...rest }) => rest)(prev) : { ...prev, [vanId]: data }); db.savePredepProgress(vanId, data); }} bookings={bookings} equipment={equipment} onBookingUpdate={handleBookingUpdate} />}
      {tab === "handover" && <HandoverPanel vans={vans} handoverTemplates={handoverTemplates} onHandoverTemplatesChange={ht => { setHandoverTemplates(ht); showToast("Walkthrough updated"); }} user={user} onComplete={handleHandoverComplete} isAdmin={user.role === "admin"} bookings={bookings} savedProgress={handoverProgress} onProgressChange={handleHandoverProgressChange} />}
      {tab === "post_trip" && <PostTripPanel vans={vans} templates={postTripTemplates} onTemplatesChange={t => { setPostTripTemplates(t); showToast("Checklist updated"); }} user={user} onComplete={handlePostTripComplete} isAdmin={user.role === "admin"} bookings={bookings} equipment={equipment} onBookingUpdate={handleBookingUpdate} savedProgress={postTripProgress} onProgressChange={handlePostTripProgressChange} />}
      {tab === "equipment" && <EquipmentPanel equipment={equipment} onEquipmentChange={handleEquipmentUpdate} rentals={[]} onRentalsChange={() => {}} user={user} isAdmin={user.role === "admin"} addLog={addLog} showToast={showToast} catalogueOnly={true} />}
      <Toast message={toast} />
    </div>
  );
}
