import { BOMS } from '@/domain/boms'
import { COMPONENTS } from '@/domain/catalog'
import { pickN, rnd } from '@/lib/prng'

/* ---------------- suppliers ---------------- */
const SUPPLIER_SEED = [
  ["Pacific Metal Forming", "Livermore, CA", true, "R. Alvarez"], ["Fastenal Industrial", "Winona, MN", true, "T. Nguyen"],
  ["Bolt & Nut Co", "Adelaide, AU", false, "S. Patel"], ["Topcon Electronics KK", "Tokyo, JP", true, "K. Sato"],
  ["EI InfoChips", "Ahmedabad, IN", true, "A. Mehta"], ["Precision Optics GmbH", "Jena, DE", false, "M. Fischer"],
  ["Cascade Circuits", "Portland, OR", true, "J. Whitaker"], ["Anhui Polymer Molding", "Hefei, CN", false, "L. Zhang"],
  ["Northline Cable Assemblies", "Guadalajara, MX", true, "C. Ibarra"], ["Baltic Enclosure Works", "Riga, LV", false, "E. Ozols"],
  ["Sierra Anodizing", "Reno, NV", false, "D. Крамер"], ["Kyushu Battery Systems", "Fukuoka, JP", true, "N. Mori"],
  ["Alpine Label & Print", "Bolzano, IT", false, "G. Rossi"], ["Deccan Precision Turning", "Pune, IN", true, "V. Iyer"],
  ["Thames Test Systems", "Reading, UK", false, "H. Blackwood"], ["Grand River Plastics", "Kitchener, CA", false, "P. Tremblay"],
  ["Iberia Harness Group", "Vigo, ES", true, "R. Nogueira"], ["Southern Cross Fabrication", "Brisbane, AU", false, "W. Tuck"],
];
/* which supplier supplies which part — generated, some parts dual sourced */
const PART_SUPPLIERS: Record<string, any> = (() => {
  const m: Record<string, any> = {};
  COMPONENTS.forEach((c: any) => {
    const n = rnd() > .78 ? 2 : rnd() > .12 ? 1 : 0;
    if (n) m[c.pn] = pickN(SUPPLIER_SEED.map((x: any) => x[0]), n);
  });
  m["1002260-01"] = ["Pacific Metal Forming"];
  m["1002261-01"] = ["Pacific Metal Forming", "Sierra Anodizing"];
  m["1005393-01"] = ["Fastenal Industrial"];
  m["1006394-01"] = ["Fastenal Industrial", "Bolt & Nut Co"];
  m["2505-0103"] = ["Bolt & Nut Co"];
  m["9060-1319"] = ["Fastenal Industrial"];
  m["1029732-01"] = ["Kyushu Battery Systems"];
  return m;
})();
const suppliersFor = (pns: any) => {
  const m: Record<string, any> = {};
  [...new Set(pns)].forEach((pn: any) => {
    const direct = PART_SUPPLIERS[pn] || [];
    const viaBom = (BOMS[pn] || []).flatMap((k: any) => PART_SUPPLIERS[k.pn] || []);
    [...new Set([...direct, ...viaBom])].forEach((sp: any) => { (m[sp] = m[sp] || []).push(pn); });
  });
  return Object.entries(m).map(([n, parts]: any) => ({ n, parts: [...new Set(parts)] }));
};
const SUPPLIERS = SUPPLIER_SEED.map(([n, site, portal, c]: any, k: any) => ({
  n, site, portal, c,
  e: c.toLowerCase().replace(/[^a-z]/g, "") + "@" + n.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + ".com",
  items: Object.values(PART_SUPPLIERS).filter((x: any) => x.includes(n)).length * 37 + k * 11,
  notify: portal ? (k % 5 === 4 ? "Every status change" : "Change complete") : "—",
  st: n === "EI InfoChips" ? "Partner" : n === "Precision Optics GmbH" ? "Invited" : "Active",
}));

export { SUPPLIER_SEED, PART_SUPPLIERS, suppliersFor, SUPPLIERS }


