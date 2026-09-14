
/* ============================= REPORTS ============================== */

const REPORT_ROWS = [
  ["1002260-01", "BKT, TS WELD-ON", "Pacific Metal Forming", "PMF-4471-B", "Livermore"],
  ["1002261-01", "BKT,TS-I3 STRAIN RELIEF", "Pacific Metal Forming", "PMF-4472", "Livermore"],
  ["1005393-01", "SCR,M6-1.0 X 20MM SOCHD 12.9 ZN", "Fastenal Industrial", "FAST-M6X20-129", "Livermore"],
  ["1006394-01", "WASHER FLAT M5", "Fastenal Industrial", "FAST-W-M5", "Livermore"],
  ["2505-0103", "SCR, M5-0.8 X 16MM HEX HD ZN", "Bolt & Nut Co", "BNC-M5-16-ZN", "Adelaide"],
  ["1021200-83", "RECEIVER, RL-H5A", "Topcon Electronics KK", "TEK-RLH5A-83", "Tokyo"],
];
const REPORT_SAMPLE = [
  ["1002260-01", "BKT TS WELD-ON", "Pacific Metal Forming", "PMF-4471-B", "Livermore"],
  ["1002261-01", "BKT TS-I3 STRAIN RELIEF", "Pacific Metal Forming", "PMF-4472", "Livermore"],
  ["1005393-01", "SCR M6-1.0 X 20MM SOCHD", "Fastenal Industrial", "FAST-M6X20-129", "Winona"],
  ["1006394-01", "WASHER FLAT M5", "Fastenal Industrial", "FAST-W-M5", "Winona"],
  ["2505-0103", "SCR M5-0.8 X 16MM HEX HD ZN", "Bolt & Nut Co", "BNC-M5-16-ZN", "Adelaide"],
  ["1021200-83", "RECEIVER RL-H5A", "Topcon Electronics KK", "TEK-RLH5A-83", "Tokyo"],
];
const FIELD_LIB = [
  { g: "Item", f: ["Item number", "Item name", "Revision", "Category", "Lifecycle phase", "Owner", "Unit of measure", "Procurement type", "Created on"] },
  { g: "SAP", f: ["Material status", "Plant", "Material group", "BOM usage", "RoHS compliant"] },
  { g: "Supplier", f: ["Supplier name", "Manufacturer part number", "Supplier site", "Sourcing status"] },
  { g: "Change", f: ["Change number", "Change category", "Routing", "Lifecycle stage", "Creator", "Submitted on", "Effective on"] },
  { g: "BOM", f: ["Parent item", "Quantity", "BOM level", "Where used count"] },
];
const SAMPLE_VALUES: Record<string, string[]> = {
  "Item number": ["1002260-01", "1002261-01", "1005393-01", "1006394-01", "2505-0103", "1021200-83"],
  "Item name": ["BKT, TS WELD-ON", "BKT,TS-I3 STRAIN RELIEF", "SCR,M6-1.0 X 20MM SOCHD", "WASHER FLAT M5", "SCR, M5-0.8 X 16MM HEX HD ZN", "RECEIVER, RL-H5A"],
  "Revision": ["B", "A", "XX", "JE", "X", "D"],
  "Category": ["BRACKETS & PLATES", "BRACKETS & PLATES", "HARDWARE", "HARDWARE", "HARDWARE", "ASSEMBLY"],
  "Lifecycle phase": ["In Production", "In Production", "In Production", "In Production", "In Production", "In Production"],
  "Owner": ["Matthew Harman", "Matthew Harman", "Fred Beachner", "Fred Beachner", "Fred Beachner", "Kathleen Whitten"],
  "Material status": ["20 – ACTIVE", "20 – ACTIVE", "20 – ACTIVE", "20 – ACTIVE", "20 – ACTIVE", "20 – ACTIVE"],
  "Plant": ["1210", "1210", "1210", "1210", "1210", "1210"],
  "Supplier name": ["Pacific Metal Forming", "Pacific Metal Forming", "Fastenal Industrial", "Fastenal Industrial", "Bolt & Nut Co", "Topcon Electronics KK"],
  "Manufacturer part number": ["PMF-4471-B", "PMF-4472", "FAST-M6X20-129", "FAST-W-M5", "BNC-M5-16-ZN", "TEK-RLH5A-83"],
  "Supplier site": ["Livermore", "Livermore", "Winona", "Winona", "Adelaide", "Tokyo"],
  "Where used count": ["3", "3", "41", "112", "47", "8"],
  "Quantity": ["1 EA", "2 EA", "4 EA", "4 EA", "4 EA", "1 EA"],
  "Change number": ["ECO-011420", "ECO-011420", "ECO-011420", "ECO-011420", "ECO-011420", "CO-002846"],
};
const valFor = (f: any, k: any) => (SAMPLE_VALUES[f] || ["—", "—", "—", "—", "—", "—"])[k];
const EXAMPLE_QUERIES = [
  "Supplier and manufacturer part number for every part on the TS CG mounting kits",
  "All kits in Construction with an open change",
  "Every part inactivated in the last 90 days and the ECO that did it",
  "Items with no primary file, grouped by owner"
];

export { REPORT_ROWS, REPORT_SAMPLE, FIELD_LIB, SAMPLE_VALUES, valFor, EXAMPLE_QUERIES }


