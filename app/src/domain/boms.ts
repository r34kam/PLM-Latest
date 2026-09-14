import { ASSEMBLIES, COMPONENTS, ITEMS } from '@/domain/catalog'
import { intIn, pickN } from '@/lib/prng'

/* dynamic BOMs — every assembly gets a real child list */
const BOMS = (() => {
  const m: Record<string, any[]> = {};
  ASSEMBLIES.forEach((a: any) => {
    const kids = pickN(COMPONENTS, Math.min(a.bom, COMPONENTS.length));
    m[a.pn] = kids.map((c: any) => ({
      pn: c.pn, rev: c.rev, name: c.name, cat: c.cat, phase: c.phase,
      qty: `${intIn(1, 8)} EA`, st: "keep", cost: c.cost,
    }));
  });
  return m;
})();
const bomFor = (pn: any) => BOMS[pn] || [];
/* the walkthrough redline stays exact */
const BOM_1003140 = [
  { pn: "1002260-01", rev: "B", name: "BKT, TS WELD-ON", cat: "Brackets & Plates", phase: "In Production", qty: "1 EA", st: "keep" },
  { pn: "1002261-01", rev: "A", name: "BKT,TS-I3 STRAIN RELIEF", cat: "Brackets & Plates", phase: "In Production", qty: "2 EA", st: "keep" },
  { pn: "1005393-01", rev: "XX", name: "SCR,M6-1.0 X 20MM SOCHD 12.9 ZN", cat: "Hardware", phase: "In Production", qty: "4 EA", st: "keep" },
  { pn: "1006394-01", rev: "JE", name: "WASHER FLAT M5", cat: "Hardware", phase: "In Production", qty: "4 EA", st: "add" },
  { pn: "2505-0103", rev: "X", name: "SCR, M5-0.8 X 16MM HEX HD ZN", cat: "Hardware", phase: "In Production", qty: "4 EA", st: "add" },
  { pn: "9060-1319", rev: "A", name: "TAPE, DIECUT 3M VHB", cat: "Adhesives", phase: "In Production", qty: "2 EA", st: "del" },
];
BOMS["1003140-01"] = BOM_1003140.filter((b: any) => b.st !== "del");
/* where used, derived from the generated BOMs */
const whereUsed = (pn: any) => Object.entries(BOMS)
  .filter(([, kids]: any) => kids.some((k: any) => k.pn === pn))
  .map(([parent]: any) => ITEMS.find((i: any) => i.pn === parent)).filter(Boolean);

export { BOMS, bomFor, BOM_1003140, whereUsed }


