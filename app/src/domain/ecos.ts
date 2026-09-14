import { ITEMS } from '@/domain/catalog'
import { PEOPLE, inGroup } from '@/domain/people'
import { ROUTINGS, deriveApprovalState } from '@/domain/routings'
import { ME } from '@/domain/session'
import { intIn, pick, rnd } from '@/lib/prng'

/* ---------------- change orders ---------------- */
const STAGES = ["Open", "Submit", "Approval", "Effective", "Complete", "Rejected"];
const CAT_BY_PREFIX: Record<string, string> = {
  ECO: "ECO: Engineering Change Order", DCO: "DCO: Document Change Order",
  TPCO: "TPCO: Third Party Change Order", RFD: "RFD: Request for Deviation",
};
const TITLE_VERBS = ["Update", "Inactivate", "Correct BOM on", "Extend to plant 1220", "Reactivate", "Add second source to",
  "Revise drawing for", "Roll revision on", "Deviate tolerance on", "Supersede"];
/* affectedAssembly — the parent kit/assembly whose BOM is being redlined.
   pn: kit PN, name: kit name, fromRev/toRev: revision bump, bomEdits: exact child changes */
type BomEdit = { op: 'ADD' | 'DELETE' | 'UPDATE_DESC'; pn: string; name: string; qty: string; newValue?: string };
type AffectedAssembly = { pn: string; name: string; fromRev: string; toRev: string; bomEdits: BomEdit[] };

const ECOS = (() => {
  const out = [
    { id: "ECO-011420", title: "Update 1003140-01", cat: CAT_BY_PREFIX.ECO, routing: "ECO Construction", stage: "Approval",
      div: "CO", site: "1210 – TPS Livermore", creator: "Matthew Harman", submitter: ME.name, created: "09/08/2026",
      submitted: "09/09/2026", items: 1, mods: 2, dc: ME.name, notes: "CCB 09.09 · DCR7-23172", mine: true, awaitingMe: false,
      pns: ["1003140-01"],
      affectedAssembly: { pn: "1003140-01", name: "KIT, TS CG MOUNTING", fromRev: "B", toRev: "C",
        bomEdits: [
          { op: "UPDATE_DESC", pn: "1003140-01", name: "KIT, TS CG MOUNTING", qty: "", newValue: "KIT, TS CG MOUNTING" },
          { op: "ADD",    pn: "1006394-01", name: "WASHER FLAT M5",                   qty: "4 EA" },
          { op: "ADD",    pn: "2505-0103",  name: "SCR, M5-0.8 X 16MM HEX HD ZN",   qty: "4 EA" },
          { op: "DELETE", pn: "9060-1319",  name: "TAPE, DIECUT 3M VHB",             qty: "2 EA" },
        ] } as AffectedAssembly,
      desc: "Update 1003140-01 to support CG-1 sensor. We are making slight changes to this warehouse kit for IMU mounting options. We are also updating the description of this kit.\n\nNo list price update is required for this change.",
      redline: "UPDATE THE FOLLOWING PRODUCTION BOM\n1003140-01  Rev B\u2192Rev C   KIT, TS CG MOUNTING\nUPDATE DESCRIPTION TO: KIT, TS CG MOUNTING\nADD 1006394-01 WASHER FLAT M5, Qty. 4\nADD 2505-0103 SCR, M5-0.8 X 16MM HEX HD ZN, Qty. 4\nDELETE 9060-1319 TAPE, DIECUT 3M VHB, Qty. 2" },
    { id: "ECO-010870", title: "Move to Status 50 – Ag Kits", cat: CAT_BY_PREFIX.ECO, routing: "ECO IA (Inactivation) – Survey",
      stage: "Open", div: "AG", site: "1210 – TPS Livermore", creator: "Nadia Haddad", submitter: "—", created: "08/26/2026",
      submitted: "—", items: 129, mods: 265, dc: ME.name, notes: "Unique-parts cascade applied", mine: true, awaitingMe: false,
      pns: ["01-080401-03"],
      affectedAssembly: { pn: "01-080401-03", name: "ASSY, RECEIVER SGR1 (SDF)", fromRev: "RV0", toRev: "IA",
        bomEdits: [
          { op: "DELETE", pn: "04-080401-10", name: "RADOME, FLASH GORDON MOLD LTGRAY SDF", qty: "1 EA" },
          { op: "DELETE", pn: "04-080401-11", name: "RADOME, FLASH GORDON (SDF)",            qty: "1 EA" },
          { op: "ADD",    pn: "05-080401-01LF", name: "ASSY, FLASH GORDON LNA PCB",          qty: "1 EA" },
          { op: "ADD",    pn: "05-080711-03LF", name: "ASSY,AG04 RECEIVER PCBA R5",          qty: "1 EA" },
        ] } as AffectedAssembly,
      desc: "Move all listed Ag kits and their unique child parts to Material Status 50 (Inactive). Parts confirmed obsolete; no remaining demand in TPS.",
      redline: "INACTIVATE THE FOLLOWING ITEMS…IN ALL PLANTS\nMOVE TO STATUS 50" },
    { id: "ECO-011288", title: "Inactivate FC-5000/SHC5000 BATTERY 1029732-01", cat: CAT_BY_PREFIX.ECO,
      routing: "ECO IA (Inactivation) – Survey", stage: "Open", div: "CO", site: "1210 – TPS Livermore",
      creator: "Nadia Haddad", submitter: "—", created: "06/26/2026", submitted: "—", items: 1, mods: 1, dc: ME.name,
      notes: "", mine: true, awaitingMe: false, pns: ["1029732-01"],
      affectedAssembly: null as unknown as AffectedAssembly,
      desc: "REFER TO PCPR-64 (EOL of 1029732-01 FC-5000/SHC5000 BATTERY)\n\nThe FC-5000/SHC5000 battery has been discontinued and removed from BIZHUB due to lack of inventory in TPS. PM confirmed there is no replacement part number for this battery.",
      redline: "INACTIVATE THE FOLLOWING ITEM…IN ALL PLANTS\n1029732-01 rev DI to rev IA\nMOVE TO STATUS 50" },
    { id: "ECO-011416", title: "BOM correction to 1007886-02", cat: CAT_BY_PREFIX.ECO, routing: "ECO Construction",
      stage: "Effective", div: "CO", site: "1210 – TPS Livermore", creator: "Matthew Harman", submitter: ME.name,
      created: "09/02/2026", submitted: "09/04/2026", items: 3, mods: 4, dc: ME.name, notes: "SAP sync complete 09/10",
      mine: false, awaitingMe: false, pns: ["1007886-02"],
      affectedAssembly: { pn: "1007886-02", name: "ASSY, GNSS ANTENNA MOUNT", fromRev: "C", toRev: "D",
        bomEdits: [
          { op: "DELETE", pn: "1002260-01", name: "BKT, TS WELD-ON", qty: "2 EA" },
          { op: "ADD",    pn: "1002260-01", name: "BKT, TS WELD-ON", qty: "4 EA" },
        ] } as AffectedAssembly,
      desc: "Correct component quantity on 1007886-02 following supplier drawing revision.", redline: "" },
    { id: "DCO-008335", title: "Reactivate 1002261-01", cat: CAT_BY_PREFIX.DCO, routing: "DCO – Document Control",
      stage: "Rejected", div: "CO", site: "1210 – TPS Livermore", creator: "Brian Johmann", submitter: ME.name,
      created: "09/03/2026", submitted: "09/05/2026", items: 1, mods: 1, dc: ME.name, notes: "Rejected by QA – evidence missing",
      mine: true, awaitingMe: false, pns: ["1002261-01"],
      affectedAssembly: null as unknown as AffectedAssembly,
      desc: "Reactivate 1002261-01 to support service demand in APAC.", redline: "" },
    { id: "CO-002846", title: "Update Two RL-H5A Sales Kits with 1021200-83", cat: CAT_BY_PREFIX.TPCO, routing: "TPCO – Third Party",
      stage: "Approval", div: "AG", site: "1210 – TPS Livermore", creator: "Kathleen Whitten", submitter: ME.name,
      created: "09/05/2026", submitted: "09/08/2026", items: 2, mods: 3, dc: ME.name, notes: "", mine: false, awaitingMe: true,
      pns: ["1021200-83"],
      affectedAssembly: { pn: "1021200-83", name: "RECEIVER, RL-H5A", fromRev: "A", toRev: "B",
        bomEdits: [
          { op: "DELETE", pn: "1003140-01", name: "KIT, TS CG MOUNTING (legacy)",  qty: "1 EA" },
          { op: "ADD",    pn: "1021200-83", name: "RECEIVER, RL-H5A 1021200-83",   qty: "1 EA" },
        ] } as AffectedAssembly,
      desc: "Replace legacy receiver in two RL-H5A sales kits with 1021200-83.", redline: "" },
    { id: "RFD-000912", title: "Deviation – solder mask tolerance", cat: CAT_BY_PREFIX.RFD, routing: "RFD – Quality",
      stage: "Approval", div: "CO", site: "1210 – TPS Livermore", creator: "Carol Nosworthy", submitter: ME.name,
      created: "09/08/2026", submitted: "09/09/2026", items: 1, mods: 1, dc: ME.name, notes: "Expires 12/31/2026",
      mine: false, awaitingMe: true, pns: ["1002260-01"],
      affectedAssembly: null as unknown as AffectedAssembly,
      desc: "Accept 500 pcs at 0.08 mm solder mask tolerance against 0.05 mm drawing callout.", redline: "" },
  ];

  const counters: Record<string, any> = { ECO: 11421, DCO: 8336, TPCO: 2847, RFD: 913 };
  for (let k = 0; k < 44; k++) {
    const pre = pick(["ECO", "ECO", "ECO", "DCO", "DCO", "TPCO", "RFD"]);
    const stage = pick(["Open", "Open", "Submit", "Approval", "Approval", "Effective", "Complete", "Complete", "Rejected"]);
    const routing = pre === "RFD" ? "RFD – Quality" : pre === "TPCO" ? "TPCO – Third Party"
      : pre === "DCO" ? "DCO – Document Control" : pick(["ECO Construction", "ECO Agriculture – Fort",
        "ECO IA (Inactivation) – Survey"]);
    const it = pick(ITEMS);
    const creator = pick(PEOPLE.filter((p: any) => !p.off));
    const items = intIn(1, pre === "ECO" ? 40 : 6);
    const mo = intIn(5, 9), da = intIn(1, 28);
    counters[pre] += intIn(1, 4);
    const num = String(counters[pre]).padStart(pre === "RFD" ? 6 : 6, "0");
    out.push({
      id: `${pre}-${num}`, title: `${pick(TITLE_VERBS)} ${it.pn}`, cat: CAT_BY_PREFIX[pre], routing, stage,
      div: it.div, site: pick(["1210 – TPS Livermore", "1220 – Fort Collins", ]),
      creator: creator.n, submitter: stage === "Open" ? "—" : ME.name,
      created: `0${mo}/${String(da).padStart(2, "0")}/2026`,
      submitted: stage === "Open" ? "—" : `0${mo}/${String(Math.min(da + 2, 28)).padStart(2, "0")}/2026`,
      items, mods: items + intIn(0, items), dc: pick([ME.name, "Adam Royce", "Hannerose Santiago"]),
      notes: rnd() > .6 ? `CCB 0${mo}.${da}` : "", mine: rnd() > .55, awaitingMe: stage === "Approval" && rnd() > .5,
      pns: [it.pn],
      affectedAssembly: it.bom > 0 ? { pn: it.pn, name: it.name,
        fromRev: pick(["A","B","C","D"]), toRev: pick(["B","C","D","E"]),
        bomEdits: [{ op: "ADD", pn: "1006394-01", name: "WASHER FLAT M5", qty: `${intIn(1,4)} EA` },
          { op: "DELETE", pn: "9060-1319", name: "TAPE, DIECUT 3M VHB", qty: "1 EA" }],
      } as AffectedAssembly : null as unknown as AffectedAssembly,
      desc: `${pick(TITLE_VERBS)} ${it.pn} — ${it.name}. Raised by ${creator.g}, ${creator.s}. ${pick([
        "No list price impact.", "Supplier drawing revision received.", "Service demand in APAC.",
        "Obsolete, no remaining demand.", "Corrects a quantity error found at kitting.",
        "Second source qualified and approved.", "Tolerance relaxed for one production lot."])}`,
      redline: "",
    });
  }
  return out;
})();
const ecoById = (id: any) => ECOS.find((e: any) => e.id === id) || ECOS[0];
const historyFor = (eco: any) => {
  const { decided } = deriveApprovalState(eco);
  return [
    ...decided.map((a: any) => ({ t: a.at, w: a.n, a: `Approved — Stage 1, ${a.g}` })),
    { t: `${eco.submitted} 10:29 AM`, w: eco.submitter === "—" ? eco.creator : eco.submitter,
      a: `Submitted to routing ${eco.routing} (${(ROUTINGS[eco.routing] || []).length} approval roles notified)` },
    { t: `${eco.created} 11:26 AM`, w: eco.creator, a: `Change created — ${eco.items} items, ${eco.mods} requested modifications` },
  ].filter((h: any) => !h.t.startsWith("—"));
};
/* unique-parts analysis for 01-080401-03 */
const UNIQUE_TREE = [
  { pn: "04-080401-10", name: "RADOME, FLASH GORDON MOLD LTGRAY SDF", lvl: 1, unique: true, parents: 1 },
  { pn: "04-080401-11", name: "RADOME, FLASH GORDON (SDF)", lvl: 1, unique: true, parents: 1 },
  { pn: "05-080401-01LF", name: "ASSY, FLASH GORDON LNA PCB", lvl: 1, unique: true, parents: 1 },
  { pn: "05-080711-03LF", name: "ASSY,AG04 RECEIVER PCBA R5", lvl: 2, unique: true, parents: 1 },
  { pn: "05-080711-08LF", name: "ASSY,PCBA AG04 RECEIVER.2 COMPASS R7.20", lvl: 2, unique: true, parents: 1 },
  { pn: "06-080401-01LF", name: "FAB, PCB FLASH GORDON LNA", lvl: 3, unique: true, parents: 1 },
  { pn: "06-080403-01LF", name: "FAB, PCB FLASH GORDON RECEIVER rv5", lvl: 3, unique: true, parents: 1 },
  { pn: "09-000410-01LF", name: "TRUPATH RECEI, PCB DIGITAL SHIELD CAP", lvl: 2, unique: true, parents: 1 },
  { pn: "09-000415-01LF", name: "LNA Shield", lvl: 2, unique: true, parents: 1 },
  { pn: "2505-0103", name: "SCR, M5-0.8 X 16MM HEX HD ZN", lvl: 2, unique: false, parents: 47 },
  { pn: "1006394-01", name: "WASHER FLAT M5", lvl: 2, unique: false, parents: 112 },
  { pn: "9060-1319", name: "TAPE, DIECUT 3M VHB", lvl: 3, unique: false, parents: 9 },
];
const CHECKS: Record<string, { k: string }> = { ok: { k: "ok" }, warn: { k: "warn" }, err: { k: "bad" } };
const EXCEL_ROWS = [
  { pn: "01-080401-03", name: "ASSY, RECEIVER SGR1 (SDF)", rev: "RV0", phase: "Discontinued", sev: "ok",
    rule: "Passed all checks", msg: "Found, revision current, not locked, no open change" },
  { pn: "04-080401-10", name: "RADOME, FLASH GORDON MOLD LTGRAY SDF", rev: "A", phase: "Discontinued", sev: "ok",
    rule: "Passed all checks", msg: "Found, revision current, not locked, no open change" },
  { pn: "05-080401-01LF", name: "ASSY, FLASH GORDON LNA PCB", rev: "C", phase: "Discontinued", sev: "warn",
    rule: "Open change", msg: "Already on ECO-011302, submitted 04 Sep by Kathleen Whitten — the two changes will collide at the effective stage" },
  { pn: "1029732-01", name: "FC-5000/SC5000 BATTERY", rev: "DI", phase: "Discontinued", sev: "warn",
    rule: "Already inactive", msg: "Material status is already 50 — INACTIVE. Adding it makes no change in SAP" },
  { pn: "1006394-01", name: "WASHER FLAT M5", rev: "JE", phase: "In Production", sev: "warn",
    rule: "Revision locked", msg: "Working revision is checked out by Kathleen Whitten and cannot be redlined until released" },
  { pn: "2505-0103", name: "SCR, M5-0.8 X 16MM HEX HD ZN", rev: "X", phase: "In Production", sev: "warn",
    rule: "Widely used", msg: "Used on 47 other assemblies — inactivating it will orphan those BOMs" },
  { pn: "05-080711-03LF", name: "ASSY,AG04 RECEIVER PCBA R5", rev: "R5", phase: "Discontinued", sev: "ok",
    rule: "Passed all checks", msg: "Found, revision current, not locked, no open change" },
  { pn: "09-99991-01", name: "—", rev: "—", phase: "—", sev: "err",
    rule: "Not found", msg: "No part number matches 09-99991-01 in this workspace" },
  { pn: "1002260-01", name: "BKT, TS WELD-ON", rev: "B", phase: "In Production", sev: "err",
    rule: "Duplicate row", msg: "Appears twice in the file, on lines 3 and 11" },
  { pn: "1031002-00", name: "KIT, SERVICE SPARES CG", rev: "A", phase: "In Production", sev: "err",
    rule: "No permission", msg: "Owned by AG Engineering – Sask. You cannot change items outside your division" },
];
const AI_SUGGEST = [
  { g: "Construction Engineering", who: inGroup("Construction Engineering").slice(0, 2).join(", "), conf: 96,
    why: "Item 1003140-01 sits in the Construction division, category KIT. All 14 prior changes on this item routed through Construction Engineering." },
  { g: "Construction Product Mgmt", who: inGroup("Construction Product Mgmt")[1], conf: 91,
    why: "Kit is a sellable configuration. SOP-DC-004 requires product management sign-off whenever a sales kit BOM changes." },
  { g: "Manufacturing Engineering", who: inGroup("Manufacturing Engineering")[0], conf: 88,
    why: "Two hardware components added. Assembly work instructions at Livermore will need revision." },
  { g: "Materials", who: inGroup("Materials")[0], conf: 84,
    why: "Added parts 1006394-01 and 2505-0103 have live purchase orders; buyer review recommended." },
  { g: "Quality Assurance (QA)", who: inGroup("Quality Assurance (QA)")[0], conf: 71,
    why: "No first-article or deviation flag on this item. Include only if the mounting tolerance is inspection-critical." },
  { g: "Sales", who: "Derek Small", conf: 22,
    why: "Description says no list price update is required, so finance review is likely unnecessary.", drop: true },
];
/* 129 items with exactly 265 modifications for ECO-010870 */
const ECO_010870_ITEMS = (() => {
  const families = [
    // 01-0804xx-xx (Parent assemblies / Kits)
    { pn: "01-080401-03", name: "ASSY, RECEIVER SGR1 (SDF)", phase: "Discontinued", newPhase: "Obsolete", rev: "RV0", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "01-080401-04", name: "ASSY, RECEIVER SGR1 DUAL (SDF)", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 2 delete", bomCount: 3, specs: false },
    { pn: "01-080402-01", name: "ASSY, AG04 AM NO MODULES", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: true },
    { pn: "01-080402-02", name: "ASSY, AG04 AM WITH CELLULAR", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "01-080405-01", name: "ASSY, SGR-1 ROVER BASE KIT", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "2 add · 2 delete", bomCount: 4, specs: true },
    { pn: "01-080405-02", name: "ASSY, SGR-1 CAB MOUNT AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: false },
    { pn: "01-080408-01", name: "KIT, AG AUTOSTEER HARNESS BUNDLE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "01-080410-00", name: "ASSY, AG04 BASE ENCLOSURE", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "01-080412-01", name: "KIT, TS CG MOUNTING", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "01-080415-02", name: "ASSY, TILT SENSOR MODULE AG", phase: "Discontinued", newPhase: "Obsolete", rev: "E", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: false },
    { pn: "01-080420-01", name: "KIT, SGR1 ROOF BRACKET AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "01-080422-03", name: "ASSY, AG04 EXPANSION DOCK", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "2 add · 0 delete", bomCount: 2, specs: true },
    { pn: "01-080425-01", name: "KIT, AG FIELD CALIBRATION SGR", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: false },
    { pn: "01-080430-02", name: "ASSY, STEERING CONTROLLER BRACKET", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "01-080435-01", name: "KIT, AG DISPLAY HEAD MOUNT", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: false },
    { pn: "01-080440-01", name: "ASSY, SGR-1 RECEIVER TOPCON AG", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "01-080442-02", name: "KIT, TS AG ANTENNA MAST", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: false },
    { pn: "01-080450-01", name: "ASSY, AG04 INTERFACE HARNESS", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "01-080455-03", name: "KIT, SGR1 REPLACEMENT SEALS", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "01-080460-01", name: "ASSY, AG LIGHTBAR GUIDANCE", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "2 add · 0 delete", bomCount: 2, specs: true },

    // 04-0804xx-xx (Plastics, Radomes, Enclosures)
    { pn: "04-080401-10", name: "RADOME, FLASH GORDON MOLD LTGRAY SDF", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080401-11", name: "RADOME, FLASH GORDON (SDF)", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080401-12", name: "RADOME, FLASH GORDON HI-TEMP AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080402-05", name: "ENCLOSURE, AG04 UPPER HOUSING", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080402-06", name: "ENCLOSURE, AG04 LOWER HOUSING", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080405-01", name: "COVER, SGR-1 BATTERY ACCESS", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080406-02", name: "GASKET, PERIMETER AG04 SEAL EPDM", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080408-01", name: "SEAL, SGR1 CONNECTOR BOOT SILICONE", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080410-03", name: "BRACKET, RADOME INTERNAL MOUNT", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080412-01", name: "BEZEL, AG DISPLAY GLASS SEALED", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080415-02", name: "CLAMP, POLE MOUNT 32MM NYLON AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080418-01", name: "VENT, MEMBRANE IP67 AG04", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080420-04", name: "HOUSING, CONNECTOR 14-PIN AG", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080425-01", name: "CAP, WEATHERPROOF TNC PROTECTIVE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080428-02", name: "INSULATOR, RF GROUND CHASSIS AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080430-01", name: "SHROUD, SUNLIGHT VISOR SGR1", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080435-03", name: "SPACER, NYLON 6/6 M4 THREADED", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080440-02", name: "BASEPLATE, DIE-CAST AL HOUSING", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "04-080445-01", name: "GROMMET, CAB CABLE ENTRY TPE", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "04-080450-02", name: "PLUG, SEALING DTM DEUTSCH AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },

    // 05-0807xx-xxLF (PCBA / Sub-assemblies)
    { pn: "05-080401-01LF", name: "ASSY, FLASH GORDON LNA PCB", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "05-080711-03LF", name: "ASSY,AG04 RECEIVER PCBA R5", phase: "Discontinued", newPhase: "Obsolete", rev: "R5", newRev: "IA", bom: "2 add · 0 delete", bomCount: 2, specs: true },
    { pn: "05-080711-08LF", name: "ASSY,PCBA AG04 RECEIVER.2 COMPASS R7.20", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "05-080712-01LF", name: "PCBA, SGR-1 GNSS TRACKING R3", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: false },
    { pn: "05-080715-02LF", name: "PCBA, AG04 POWER MANAGEMENT", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "05-080718-01LF", name: "PCBA, SGR1 RF FILTER STAGE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: false },
    { pn: "05-080720-03LF", name: "PCBA, DUAL CAN-BUS ISOLATOR AG", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "05-080722-01LF", name: "PCBA, SERIAL LEVEL SHIFTER RS232", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "05-080725-04LF", name: "PCBA, BLUETOOTH BLE 4.2 MODULE AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "05-080728-02LF", name: "PCBA, SGR-1 STATUS LED INDICATOR", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: false },
    { pn: "05-080730-01LF", name: "PCBA, INTERNAL BACKUP BATTERY CHG", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "05-080733-02LF", name: "PCBA, UHF RADIO TRANSCEIVER 450M", phase: "Discontinued", newPhase: "Obsolete", rev: "E", newRev: "IA", bom: "1 add · 2 delete", bomCount: 3, specs: true },
    { pn: "05-080735-01LF", name: "PCBA, CELLULAR MODEM 3G CAT-1 AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: false },
    { pn: "05-080740-03LF", name: "PCBA, ESD PROTECTION IO BOARD", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "05-080742-01LF", name: "PCBA, PRECISION TCXO OSCILLATOR", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: false },
    { pn: "05-080745-02LF", name: "PCBA, IMU 6-AXIS ACCEL SENSOR AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "2 add · 0 delete", bomCount: 2, specs: true },
    { pn: "05-080750-01LF", name: "PCBA, AG04 MEMORY FLASH SPI 64M", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "05-080752-03LF", name: "PCBA, SGR1 POWER INVERTER 12V-5V", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "05-080755-01LF", name: "PCBA, DIGITIZER ADC FRONT-END", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: false },
    { pn: "05-080760-02LF", name: "PCBA, ANTENNA LNA BIAS-TEE AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: true },

    // 06-0804xx-xxLF (Bare PCBs / Fabrication)
    { pn: "06-080401-01LF", name: "FAB, PCB FLASH GORDON LNA", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080403-01LF", name: "FAB, PCB FLASH GORDON RECEIVER rv5", phase: "Discontinued", newPhase: "Obsolete", rev: "rv5", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080405-02LF", name: "FAB, PCB AG04 MOTHERBOARD 6-LAYER", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080408-01LF", name: "FAB, PCB COMPASS SENSOR R7 FR4", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080410-03LF", name: "FAB, PCB POWER SUPPLY 2OZ COPPER", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080412-01LF", name: "FAB, PCB INTERCONNECT RIGID-FLEX", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080415-02LF", name: "FAB, PCB RF FILTER ROGERS 4350B", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080418-01LF", name: "FAB, PCB LED DISPLAY INDICATOR", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080420-02LF", name: "FAB, PCB CAN ISOLATOR INTERFACE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080422-04LF", name: "FAB, PCB MODEM CARRIER BOARD", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080425-01LF", name: "FAB, PCB BLE TRANSCEIVER EMBEDDED", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080428-03LF", name: "FAB, PCB BATTERY CHARGER CONTROLLER", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080430-01LF", name: "FAB, PCB TCXO OSCILLATOR BUFFER", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080435-02LF", name: "FAB, PCB ESD PROTECTION DUAL-LAYER", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080440-01LF", name: "FAB, PCB IMU SENSOR INTERFACE AG", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080445-03LF", name: "FAB, PCB MEMORY STORAGE MODULE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080450-01LF", name: "FAB, PCB DC-DC CONVERTER 4-LAYER", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080455-02LF", name: "FAB, PCB BIAS-TEE FILTER BOARD", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "06-080460-01LF", name: "FAB, PCB FRONT-END RECEIVER SDF", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "06-080465-02LF", name: "FAB, PCB GPS PATCH FEED NETWORK", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },

    // 09-0004xx-xxLF (Shields / Mechanical brackets)
    { pn: "09-000410-01LF", name: "TRUPATH RECEI, PCB DIGITAL SHIELD CAP", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000415-01LF", name: "LNA Shield", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000420-02LF", name: "SHIELD, RF CAVITY TIN-PLATED AG04", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000422-01LF", name: "SHIELD, TCXO OSCILLATOR CAN", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000425-03LF", name: "CLIP, EMI SHIELD FINGER BRASS", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000428-01LF", name: "SHIELD, POWER INDUCTOR ISOLATION", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000430-02LF", name: "COVER, RF FILTER DIE-CAST SDF", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000435-01LF", name: "SHIELD, MODEM COMPARTMENT AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000438-02LF", name: "BRACKET, PCBA RETENTION STAINLESS", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000440-01LF", name: "SHIELD, MEMORY SPI BUS COPPER", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000442-03LF", name: "HEATSINK, DC-DC CONVERTER AL", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000445-01LF", name: "GASKET, CONDUCTIVE SILICONE EMI", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000448-02LF", name: "SHIELD, BLE ANTENNA GROUND PLANE", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000450-01LF", name: "CLAMP, CABLE RETENTION INTERNAL", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000452-03LF", name: "SHIELD, ADC INPUT COMPONENT CAN", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000455-01LF", name: "STRAP, GROUND BRAID CHASSIS 50MM", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000458-02LF", name: "SHIELD, CONNECTOR HEADER DTM", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "09-000460-01LF", name: "PLATE, THERMAL INTERFACE GRAPHITE", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000462-02LF", name: "SHIELD, GNSS LNA FRONT END", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "09-000465-01LF", name: "SPRING, CONTACT GROUNDING BERYLLIUM", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },

    // 10xxxxx-xx (Finished kits, Hardware, Cables & Miscellaneous Ag Parts)
    { pn: "1003140-02", name: "KIT, TS CG MOUNTING SPARES AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "1004520-01", name: "CABLE, AG04 POWER HARNESS 3M", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1004521-02", name: "CABLE, SGR1 DATA SERIAL DB9 5M", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "1004525-01", name: "CABLE, ANTENNA TNC-M TO TNC-M 2M", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005110-01", name: "KIT, TS AG CALIBRATION TARGETS", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "2 add · 0 delete", bomCount: 2, specs: true },
    { pn: "1005112-03", name: "HARNESS, CAN EXTENSION DTP 4M", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005115-01", name: "BRACKET, CAB PILLAR MOUNT SDF", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "1005120-02", name: "KIT, SGR1 WEATHERPROOF HARDWARE", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: false },
    { pn: "1005125-01", name: "PLATE, ROOF ADAPTER MAGNETIC AG", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "1005130-03", name: "CABLE, BATTERY SENSING ISOLATED", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005135-01", name: "KIT, TS AG TILT COMPENSATION", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "1005140-02", name: "SCREW, M4-0.7X12MM PANHD SS TORX", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005142-01", name: "WASHER, FLAT M4 18-8 SS PASSIVATED", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005145-03", name: "NUT, NYLOC HEX M4-0.7 SS AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005150-01", name: "KIT, AG RECEIVER SPARE GASKETS", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: true },
    { pn: "1005155-02", name: "FUSE, MINI BLADE 5A AUTOMOTIVE AG", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005160-01", name: "KIT, FIELD SERVICE SGR1 SPARES", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "2 add · 1 delete", bomCount: 3, specs: true },
    { pn: "1005165-03", name: "LABEL, WARNING HIGH VOLTAGE CAB", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005170-01", name: "LABEL, TOPCON AG04 RATING IDENT", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: true },
    { pn: "1005175-02", name: "MANUAL, AG OPERATOR QUICKSTART", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005180-01", name: "KIT, TS AG BASE MAST EXTENSION", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: "0 add · 1 delete", bomCount: 1, specs: true },
    { pn: "1005185-02", name: "TIE-WRAP, UV RESISTANT BLACK 200MM", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005190-01", name: "ADHESIVE, RTV SILICONE SEALANT 100ML", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005195-03", name: "KIT, SGR1 DESICCA-BAG REPLACEMENT", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: "1 add · 0 delete", bomCount: 1, specs: true },
    { pn: "1005200-01", name: "TERMINATOR, CAN BUS 120 OHM RESIST", phase: "Discontinued", newPhase: "Obsolete", rev: "C", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005205-02", name: "COVER, DUST PLUG DB9 CONNECTOR", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005210-01", name: "KIT, TS AG POWER TAP INLINE", phase: "Discontinued", newPhase: "Obsolete", rev: "B", newRev: "IA", bom: "1 add · 1 delete", bomCount: 2, specs: true },
    { pn: "1005215-03", name: "RELAY, 12V 40A AUTOMOTIVE AG SEALED", phase: "Discontinued", newPhase: "Obsolete", rev: "A", newRev: "IA", bom: null, bomCount: 0, specs: false },
    { pn: "1005220-01", name: "KIT, TS AG FUSE HOLDER SPLICE", phase: "Discontinued", newPhase: "Obsolete", rev: "D", newRev: "IA", bom: "0 add · 2 delete", bomCount: 2, specs: true }
  ];

  return families;
})();
/* =========================== ECO DETAIL ============================= */

const LC = ["Open", "Submit", "Approval", "Effective", "Complete"];

export { STAGES, CAT_BY_PREFIX, TITLE_VERBS, ECOS, ecoById, historyFor, UNIQUE_TREE, CHECKS, EXCEL_ROWS, AI_SUGGEST, ECO_010870_ITEMS, LC }


