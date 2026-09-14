import { PEOPLE } from '@/domain/people'
import { intIn, pick, rnd } from '@/lib/prng'

/* ---------------- items ---------------- */
const CATS = ["KIT", "ASSEMBLY", "PCB", "HARDWARE", "BRACKETS & PLATES", "CABLE", "ENCLOSURE", "BATTERY", "LABEL", "SOFTWARE"];
const ITEM_NAMES: Record<string, string[]> = {
  KIT: ["KIT, TS CG MOUNTING", "KIT, SALES TS CG BUNDLE", "KIT, RL-H5A SALES", "KIT, SERVICE SPARES CG", "KIT, GNSS BASE STATION",
    "KIT, MC-X1 MACHINE CONTROL", "KIT, LN-150 LAYOUT NAVIGATOR", "KIT, HIPER VR ROVER", "KIT, FIELD SPARES AG"],
  ASSEMBLY: ["ASSY, RECEIVER SGR1 (SDF)", "ASSY, GNSS ANTENNA MOUNT", "ASSY, AG04 AM NO MODULES", "ASSY, FLASH GORDON LNA PCB",
    "ASSY, TILT SENSOR MODULE", "ASSY, RADIO MODEM UHF II", "ASSY, DISPLAY HEAD FC-6000", "ASSY, IMU CG-1 SENSOR"],
  PCB: ["FAB, PCB FLASH GORDON LNA", "FAB, PCB FLASH GORDON RECEIVER", "PCBA, AG04 RECEIVER R5", "PCBA, COMPASS R7.20",
    "PCB, POWER REGULATION 5V", "PCB, DIGITAL SHIELD CAP"],
  HARDWARE: ["SCR,M6-1.0 X 20MM SOCHD 12.9 ZN", "WASHER FLAT M5", "SCR, M5-0.8 X 16MM HEX HD ZN", "NUT, HEX M6 ZN",
    "SCR, M4-0.7 X 10MM PANHD SS", "WASHER LOCK M6 SS", "STANDOFF, M3 X 12MM BRASS", "RIVET, BLIND 4MM AL"],
  "BRACKETS & PLATES": ["BKT, TS WELD-ON", "BKT,TS-I3 STRAIN RELIEF", "PLATE, MOUNTING BASE AL", "BKT, ANTENNA POLE CLAMP",
    "PLATE, COVER REAR ENCLOSURE"],
  CABLE: ["CABLE, POWER 2M BARE LEADS", "CABLE, DATA RS-232 5M", "CABLE, ANTENNA TNC 1.5M", "HARNESS, MC-X1 MAIN"],
  ENCLOSURE: ["ENCL, RECEIVER IP67 AL", "ENCL, DISPLAY FC-6000", "RADOME, FLASH GORDON LTGRAY", "COVER, BATTERY COMPARTMENT"],
  BATTERY: ["FC-5000/SC5000 BATTERY", "BATTERY, BDC-72 LI-ION", "BATTERY, HIPER VR INTERNAL"],
  LABEL: ["LABEL, SERIAL NUMBER 30X15", "LABEL, CE MARK 20X10", "LABEL, WARNING LASER APERTURE"],
  SOFTWARE: ["SW, MAGNET FIELD v8.2", "SW, RECEIVER FIRMWARE 5.4.1", "SW, MC-X1 CONTROLLER 3.0"],
};
const PROCS = ["Made-to-Specification (MTS)", "Made-to-Print", "Purchased", "Assembled in house"];
const PHASES = ["In Production", "In Production", "In Production", "In Production", "Discontinued", "Prototype", "Obsolete"];
const ITEMS = (() => {
  const out = [];
  let n = 1002200;
  Object.entries(ITEM_NAMES).forEach(([cat, names]: any) => {
    names.forEach((nm: any, k: any) => {
      n += intIn(11, 260);
      const phase = k === 0 && cat === "KIT" ? "In Production" : pick(PHASES);
      const isAssy = ["KIT", "ASSEMBLY", "PCB"].includes(cat);
      const owner = pick(PEOPLE.filter((p: any) => !p.off));
      out.push({
        pn: `${n}-0${intIn(1, 3)}`, rev: pick(["A", "B", "C", "D", "F", "JE", "X", "XX", "RV0", "DI"]),
        name: nm, cat, phase,
        owner: owner.n, plant: pick(["1210 – TPS Livermore", "1220 – Fort Collins", "1310 – Adelaide", "1410 – Tokyo"]),
        status: phase === "Obsolete" ? "50 – INACTIVE" : phase === "Prototype" ? "10 – NEW" : "20 – ACTIVE",
        uom: "EA", proc: pick(PROCS),
        mg: pick(["002 – Construction", "004 – Agriculture", "006 – Survey"]),
        rohs: rnd() > .08 ? "Yes" : "Exempt",
        bom: isAssy ? intIn(3, 14) : 0,
        div: pick(["CO", "AG"]),
        created: `${String(intIn(1, 12)).padStart(2, "0")}/${String(intIn(1, 28)).padStart(2, "0")}/${intIn(2011, 2025)}`,
        cost: (rnd() * 240 + 2).toFixed(2),
      });
    });
  });
  /* the walkthrough items keep their real identifiers */
  out.unshift(
    { pn: "1003140-01", rev: "C", name: "KIT, TS CG MOUNTING", cat: "KIT", phase: "In Production", owner: "Steve Howe",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 5, div: "CO", created: "08/01/2013", cost: "64.20" },
    { pn: "01-080401-03", rev: "RV0", name: "ASSY, RECEIVER SGR1 (SDF)", cat: "ASSEMBLY", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 12, div: "AG", created: "06/12/2012", cost: "412.00" },
    { pn: "1029732-01", rev: "DI", name: "FC-5000/SC5000 BATTERY", cat: "BATTERY", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Purchased",
      mg: "004 – Agriculture", rohs: "Yes", bom: 0, div: "AG", created: "06/12/2012", cost: "88.00" },
    { pn: "1002260-01", rev: "B", name: "BKT, TS WELD-ON", cat: "BRACKETS & PLATES", phase: "In Production", owner: "Matthew Harman",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Print",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "03/14/2015", cost: "12.40" },
    { pn: "1002261-01", rev: "A", name: "BKT,TS-I3 STRAIN RELIEF", cat: "BRACKETS & PLATES", phase: "In Production", owner: "Matthew Harman",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Print",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "03/14/2015", cost: "8.10" },
    { pn: "1005393-01", rev: "XX", name: "SCR,M6-1.0 X 20MM SOCHD 12.9 ZN", cat: "HARDWARE", phase: "In Production", owner: "Fred Beachner",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Purchased",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "01/09/2016", cost: "0.41" },
    { pn: "1006394-01", rev: "JE", name: "WASHER FLAT M5", cat: "HARDWARE", phase: "In Production", owner: "Fred Beachner",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Purchased",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "01/09/2016", cost: "0.07" },
    { pn: "2505-0103", rev: "X", name: "SCR, M5-0.8 X 16MM HEX HD ZN", cat: "HARDWARE", phase: "In Production", owner: "Fred Beachner",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Purchased",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "01/09/2016", cost: "0.22" },
    { pn: "9060-1319", rev: "A", name: "TAPE, DIECUT 3M VHB", cat: "HARDWARE", phase: "In Production", owner: "Fred Beachner",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Purchased",
      mg: "002 – Construction", rohs: "Yes", bom: 0, div: "CO", created: "05/02/2014", cost: "1.85" },
    { pn: "1007886-02", rev: "F", name: "ASSY, GNSS ANTENNA MOUNT", cat: "ASSEMBLY", phase: "In Production", owner: "Matthew Harman",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "002 – Construction", rohs: "Yes", bom: 6, div: "CO", created: "05/21/2017", cost: "148.00" },
    { pn: "1021200-83", rev: "D", name: "RECEIVER, RL-H5A 1021200-83", cat: "ASSEMBLY", phase: "In Production", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 8, div: "AG", created: "11/02/2019", cost: "620.00" },
    { pn: "04-080401-10", rev: "A", name: "RADOME, FLASH GORDON MOLD LTGRAY SDF", cat: "ENCLOSURE", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 0, div: "AG", created: "06/12/2012", cost: "34.50" },
    { pn: "05-080401-01LF", rev: "C", name: "ASSY, FLASH GORDON LNA PCB", cat: "PCB", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 2, div: "AG", created: "06/12/2012", cost: "94.00" },
    { pn: "04-080401-11", rev: "B", name: "RADOME, FLASH GORDON (SDF)", cat: "ENCLOSURE", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 0, div: "AG", created: "06/12/2012", cost: "31.20" },
    { pn: "05-080711-03LF", rev: "R5", name: "ASSY,AG04 RECEIVER PCBA R5", cat: "PCB", phase: "Discontinued", owner: "Kathleen Whitten",
      plant: "1210 – TPS Livermore", status: "50 – INACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 2, div: "AG", created: "06/12/2012", cost: "112.00" },
    { pn: "1031002-00", rev: "A", name: "KIT, SERVICE SPARES CG", cat: "KIT", phase: "In Production", owner: "Tomas Ruiz",
      plant: "1220 – Fort Collins", status: "20 – ACTIVE", uom: "EA", proc: "Made-to-Specification (MTS)",
      mg: "004 – Agriculture", rohs: "Yes", bom: 3, div: "AG", created: "04/18/2018", cost: "145.00" },
  );
  return out;
})();
const COMPONENTS = ITEMS.filter((i: any) => i.bom === 0);
const ASSEMBLIES = ITEMS.filter((i: any) => i.bom > 0);

export { CATS, ITEM_NAMES, PROCS, PHASES, ITEMS, COMPONENTS, ASSEMBLIES }


