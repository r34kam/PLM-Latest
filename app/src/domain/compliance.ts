import { ITEMS } from '@/domain/catalog'

/* ---- per-item compliance requirements -------------------------------- */
type CompReq = {
  name: string;
  status: "Compliant" | "Non-Compliant" | "Exempt" | "Pending" | "Waived";
  rationale: string;
  mark: string;
  evidence: string;
  lastModified: string;
  modifier: string;
};
const COMPLIANCE_REQS: Record<string, CompReq[]> = {
  "1003140-01": [
    { name: "ROHS COMPLIANT", status: "Compliant",
      rationale: "Once all BOM items are compliant, the top level is automatically compliant. No certificate required.",
      mark: "RoHS", evidence: "None required", modifier: "Carol Nosworthy", lastModified: "07/20/2017 03:07 PM" },
    { name: "REACH SVHC", status: "Compliant",
      rationale: "No substances of very high concern identified in any BOM child.",
      mark: "REACH", evidence: "Supplier SDS on file", modifier: "Steve Howe", lastModified: "01/14/2020 10:22 AM" },
  ],
  "01-080401-03": [
    { name: "ROHS COMPLIANT", status: "Exempt",
      rationale: "Assembly contains military-spec components exempt under Annex III. Exemption certificate on file.",
      mark: "RoHS", evidence: "RoHS Exemption Cert #RE-2012-047", modifier: "Jeni Hirth", lastModified: "06/12/2012 09:15 AM" },
    { name: "CONFLICT MINERALS (3TG)", status: "Compliant",
      rationale: "Supplier conflict minerals declarations received and validated for all sub-components.",
      mark: "CMRT", evidence: "CMRT v6.1 – June 2022", modifier: "Jeni Hirth", lastModified: "06/05/2022 02:44 PM" },
  ],
  "1007886-02": [
    { name: "ROHS COMPLIANT", status: "Compliant",
      rationale: "All six sub-assemblies carry valid RoHS declarations. Top level inherits compliant status.",
      mark: "RoHS", evidence: "None required", modifier: "Matthew Harman", lastModified: "05/21/2017 11:30 AM" },
    { name: "FCC PART 15 CLASS B", status: "Compliant",
      rationale: "Tested to FCC Part 15 Class B emissions limits. Certificate issued 2019.",
      mark: "FCC", evidence: "FCC ID: PVH-1007886B", modifier: "Kathleen Whitten", lastModified: "03/08/2019 04:00 PM" },
    { name: "CE MARKING", status: "Compliant",
      rationale: "Meets essential requirements of RED 2014/53/EU and EMC 2014/30/EU directives.",
      mark: "CE", evidence: "DoC ref: CE-1007886-02", modifier: "Matthew Harman", lastModified: "11/15/2019 09:00 AM" },
  ],
  "1021200-83": [
    { name: "ROHS COMPLIANT", status: "Compliant",
      rationale: "All eight PCB sub-assemblies RoHS compliant per supplier declaration.",
      mark: "RoHS", evidence: "Supplier declaration on file", modifier: "Kathleen Whitten", lastModified: "11/02/2019 08:00 AM" },
    { name: "FCC PART 15 CLASS B", status: "Pending",
      rationale: "FCC test report submitted. Awaiting agency acknowledgment.",
      mark: "FCC", evidence: "Test report TR-2023-RL-H5A", modifier: "Kathleen Whitten", lastModified: "04/12/2023 01:15 PM" },
    { name: "REACH SVHC", status: "Compliant",
      rationale: "No SVHC above 0.1% w/w identified across all materials.",
      mark: "REACH", evidence: "Material disclosure form MDF-2019-083", modifier: "Kathleen Whitten", lastModified: "11/02/2019 08:30 AM" },
  ],
  "1031002-00": [
    { name: "ROHS COMPLIANT", status: "Compliant",
      rationale: "All three spare-kit components sourced from RoHS-certified suppliers.",
      mark: "RoHS", evidence: "Supplier CoC #4421", modifier: "Tomas Ruiz", lastModified: "04/18/2018 10:00 AM" },
    { name: "BATTERY TRANSPORT (UN 38.3)", status: "Compliant",
      rationale: "Replacement battery cells passed UN 38.3 transport test series.",
      mark: "UN 38.3", evidence: "Test summary UN38.3-2018-KIT", modifier: "Tomas Ruiz", lastModified: "04/18/2018 11:00 AM" },
    { name: "CONFLICT MINERALS (3TG)", status: "Waived",
      rationale: "Service-spares kit is not a product for commercial sale; CMRT waiver applied by compliance team.",
      mark: "CMRT", evidence: "Waiver #CMW-2018-031", modifier: "Amy Pearce", lastModified: "05/02/2018 03:30 PM" },
  ],
  "1029732-01": [
    { name: "ROHS COMPLIANT", status: "Exempt",
      rationale: "Battery cells exempt under RoHS Annex II — portable batteries for replacement are excluded.",
      mark: "RoHS", evidence: "Annex II exemption self-declaration", modifier: "Jeni Hirth", lastModified: "06/12/2012 09:00 AM" },
    { name: "BATTERY TRANSPORT (UN 38.3)", status: "Compliant",
      rationale: "Battery pack passed all eight UN 38.3 tests. Summary on file.",
      mark: "UN 38.3", evidence: "Test cert UN38-2012-FC5000", modifier: "Jeni Hirth", lastModified: "06/12/2012 09:30 AM" },
  ],
  "1007887-01": [
    { name: "ROHS COMPLIANT", status: "Compliant",
      rationale: "Once all BOM items are compliant, the top level is automatically compliant. No certificate required.",
      mark: "RoHS", evidence: "None required", modifier: "Carol Nosworthy", lastModified: "07/20/2017 03:07 PM" },
    { name: "FCC PART 15 CLASS B", status: "Compliant",
      rationale: "Receiver assembly tested and certified to FCC Part 15 Class B unintentional radiator limits.",
      mark: "FCC", evidence: "FCC ID: PVH-1007887AG04", modifier: "Mamatha Gopal", lastModified: "04/22/2016 11:00 AM" },
    { name: "CE MARKING (EMC)", status: "Compliant",
      rationale: "Meets essential health, safety and environmental requirements under EMC Directive 2014/30/EU.",
      mark: "CE", evidence: "DoC ref: CE-AG04-AM-2016", modifier: "Mamatha Gopal", lastModified: "04/22/2016 11:30 AM" },
    { name: "CONFLICT MINERALS (3TG)", status: "Compliant",
      rationale: "All AG04 module suppliers provided valid CMRT v6.1 declarations — no conflict minerals sourced from covered countries.",
      mark: "CMRT", evidence: "CMRT v6.1 – Dec 2023", modifier: "Carol Nosworthy", lastModified: "12/15/2023 09:45 AM" },
  ],
};
/** Returns compliance requirements for a given part number.
 *  Falls back to a sensible single-row default for items not explicitly mapped. */
function complianceFor(pn: string): CompReq[] {
  if (COMPLIANCE_REQS[pn]) return COMPLIANCE_REQS[pn];
  // Auto-generate a plausible default so every item has at least one row
  const item = ITEMS.find((i: any) => i.pn === pn);
  const rohs = item?.rohs ?? "Yes";
  return [
    {
      name: "ROHS COMPLIANT",
      status: rohs === "Yes" ? "Compliant" : "Exempt",
      rationale: rohs === "Yes"
        ? "Item and all sub-components comply with RoHS 2011/65/EU as amended."
        : "Item contains components exempt under RoHS Annex III or Annex IV.",
      mark: "RoHS",
      evidence: rohs === "Yes" ? "None required" : "Exemption self-declaration",
      modifier: item?.owner ?? "—",
      lastModified: item?.created
        ? `${item.created} 09:00 AM`
        : "—",
    },
  ];
}
const STATUS_CHIP: Record<CompReq["status"], { k: string; label: string }> = {
  "Compliant":     { k: "ok",   label: "Compliant" },
  "Non-Compliant": { k: "bad",  label: "Non-Compliant" },
  "Exempt":        { k: "warn", label: "Exempt" },
  "Pending":       { k: "warn", label: "Pending" },
  "Waived":        { k: "g",    label: "Waived" },
};

export { COMPLIANCE_REQS, complianceFor, STATUS_CHIP }
export type { CompReq }

