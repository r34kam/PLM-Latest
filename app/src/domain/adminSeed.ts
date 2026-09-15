import { inGroup } from '@/domain/people'
import { ROUTINGS, ROUTING_NAMES } from '@/domain/routings'

/* ============================== ADMIN =============================== */



const ROLE_SEED = [...new Set(Object.values(ROUTINGS).flat().map((r: any) => r.g))].map((g: any) => {
  const base = g.split(" – ")[0], site = g.split(" – ")[1];
  return { n: g, div: base.startsWith("AG") ? "AG" : base.startsWith("Construction") ? "CO" : "Both",
    site: site || "All sites", m: inGroup(base, site) };
});
const ROUTING_FORM_MAP: Record<string, string> = {
  "ECO Construction": "form-eco",
  "ECO Agriculture – Fort": "form-eco",
  "ECO Agriculture – Adelaide": "form-eco",
  "ECO IA (Inactivation) – Survey": "form-eco",
  "ECO Tokyo – Electronics": "form-eco",
  "DCO – Document Control": "form-dco",
  "TPCO – Third Party": "form-tpco",
  "RFD – Quality": "form-eco",
};
const ROUTING_SEED = ROUTING_NAMES.map((n: any) => ({
  n, div: n.includes("Agriculture") ? "AG" : "CO",
  used: 40 + (n.length * 17) % 380, stages: ROUTINGS[n],
  formId: ROUTING_FORM_MAP[n] ?? "form-eco",
}));
const FIELD_TYPES = ["Single line text", "Long text", "Picklist", "Number", "Date", "Person", "Checkbox", "Item reference", "Auto-generated"];

export { ROLE_SEED, ROUTING_FORM_MAP, ROUTING_SEED, FIELD_TYPES }


