import { ME } from '@/domain/session'
import { initials } from '@/lib/prng'

const SITES = ["Livermore", "Fort Collins"];
const GROUPS = [
  "Construction Engineering", "Construction Product Mgmt", "AG Engineering", "AG Product Mgmt",
  "Manufacturing Engineering", "Manufacturing Test Engineering", "Master Scheduling", "Materials",
  "PLM", "Quality Assurance (QA)", "Sales", "Service",
  "Document Control TPS",
];
const NAMES = [
  ["Hannerose Santiago", "Document Control TPS", "Livermore"],
  ["Adam Royce",        "Document Control TPS", "Livermore"],
  ["Matthew Harman",   "Construction Engineering", "Livermore"],
  ["Roslyne Peters",   "Construction Engineering", "Livermore"],
  ["Brian Johmann",    "Construction Product Mgmt", "Livermore"],
  ["Kathleen Whitten", "AG Engineering", "Fort Collins"],
  ["Nadia Haddad",     "AG Product Mgmt", "Fort Collins"],
  ["Fred Beachner",    "Manufacturing Engineering", "Livermore"],
  ["Ahmed Farouk",     "Manufacturing Test Engineering", "Livermore"],
  ["John Dice",        "Master Scheduling", "Livermore"],
  ["Jon Olson",        "Materials", "Livermore"],
  ["Steve Howe",       "PLM", "Livermore"],
  ["Carol Nosworthy",  "Quality Assurance (QA)", "Livermore"],
  ["Derek Small",      "Sales", "Livermore"],
  ["Oliver Grant",     "Service", "Livermore"],
];
const PEOPLE = NAMES.map(([n, g, s2]: any, k: any) => ({
  n, g, s: s2, init: initials(n),
  email: n.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, ".") + (g === "PLM" && s2 === "Ahmedabad" ? "@eiinfochips.com" : "@topcon.com"),
  off: false,
  type: s2 === "Ahmedabad" ? "Partner" : "Employee",
  access: n === ME.name || n === "Adam Royce" ? "Administrator" : k % 11 === 0 ? "View only" : "Standard user",
  div: g.startsWith("AG") ? "AG" : g.startsWith("Construction") ? "CO" : "Both",
}));
const inGroup = (g: any, site?: any) => PEOPLE.filter((p: any) => p.g === g && (!site || p.s === site)).map((p: any) => p.n);

export { SITES, GROUPS, NAMES, PEOPLE, inGroup }


