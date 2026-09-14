import { ME } from '@/domain/session'
import { initials } from '@/lib/prng'

const SITES = ["Livermore", "Fort Collins", "Adelaide", "Sask", "Tokyo", "Ahmedabad"];
const GROUPS = [
  "Construction Engineering", "Construction Product Mgmt", "AG Engineering", "AG Product Mgmt",
  "Manufacturing Engineering", "Manufacturing Test Engineering", "Master Scheduling", "Materials",
  "PLM", "Production", "Quality Assurance (QA)", "Sales", "Service", "Finance",
  "Document Control TPS", "AG Doc Control", "ECCN Verification", "TEP NPI",
];
const NAMES = [
  ["Hannerose Santiago", "Document Control TPS", "Livermore"], ["Adam Royce", "Document Control TPS", "Livermore"],
  ["Matthew Harman", "Construction Engineering", "Livermore"], ["Roslyne Peters", "Construction Engineering", "Livermore"],
  ["Wendy Veth", "Construction Engineering", "Livermore"], ["Daniel Okonkwo", "Construction Engineering", "Livermore"],
  ["Abe Salman", "Construction Product Mgmt", "Livermore"], ["Ariel Mendez", "Construction Product Mgmt", "Livermore"],
  ["Brian Johmann", "Construction Product Mgmt", "Livermore"], ["Priya Raman", "Construction Product Mgmt", "Livermore"],
  ["Kathleen Whitten", "AG Engineering", "Fort Collins"], ["Jeni Hirth", "AG Engineering", "Sask"],
  ["Lars Andersen", "AG Engineering", "Adelaide"], ["Mei-Ling Chow", "AG Engineering", "Fort Collins"],
  ["Tomas Ruiz", "AG Engineering", "Sask"], ["Nadia Haddad", "AG Product Mgmt", "Fort Collins"],
  ["Greg Lindqvist", "AG Product Mgmt", "Adelaide"], ["Sofia Bianchi", "AG Product Mgmt", "Fort Collins"],
  ["Fred Beachner", "Manufacturing Engineering", "Livermore"], ["Marcus Bell", "Manufacturing Engineering", "Livermore"],
  ["Yuki Tanaka", "Manufacturing Engineering", "Tokyo"], ["Rosa Delgado", "Manufacturing Engineering", "Adelaide"],
  ["Ahmed Farouk", "Manufacturing Test Engineering", "Livermore"], ["Ingrid Sorensen", "Manufacturing Test Engineering", "Tokyo"],
  ["John Dice", "Master Scheduling", "Livermore"], ["Claire Dubois", "Master Scheduling", "Fort Collins"],
  ["Hiro Nakamura", "Master Scheduling", "Tokyo"], ["Jon Olson", "Materials", "Livermore"],
  ["Anika Bose", "Materials", "Ahmedabad"], ["Peter Vance", "Materials", "Adelaide"],
  ["Luis Moreno", "Materials", "Fort Collins"], ["Steve Howe", "PLM", "Livermore"],
  ["Rahul Desai", "PLM", "Ahmedabad"], ["Elena Petrova", "PLM", "Livermore"],
  ["Grace Mutiso", "Production", "Livermore"], ["Tom Bradshaw", "Production", "Adelaide"],
  ["Sanjay Kulkarni", "Production", "Ahmedabad"], ["Carol Nosworthy", "Quality Assurance (QA)", "Livermore"],
  ["Lena Okafor", "Quality Assurance (QA)", "Livermore"], ["Marco Silva", "Quality Assurance (QA)", "Adelaide"],
  ["Anna Kowalski", "Quality Assurance (QA)", "Fort Collins"], ["Derek Small", "Sales", "Livermore"],
  ["Camille Roux", "Sales", "Fort Collins"], ["Kenji Sato", "Sales", "Tokyo"],
  ["Bianca Ferreira", "Service", "Adelaide"], ["Oliver Grant", "Service", "Livermore"],
  ["Kevin Li", "Finance", "Livermore"], ["Naomi Adeyemi", "Finance", "Fort Collins"],
  ["Mamatha Gopal", "AG Doc Control", "Adelaide"], ["Ravi Menon", "AG Doc Control", "Fort Collins"],
  ["Dana Whitfield", "ECCN Verification", "Livermore"], ["Paul Genet", "TEP NPI", "Fort Collins"],
];
const PEOPLE = NAMES.map(([n, g, s2]: any, k: any) => ({
  n, g, s: s2, init: initials(n),
  email: n.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, ".") + (g === "PLM" && s2 === "Ahmedabad" ? "@eiinfochips.com" : "@topcon.com"),
  off: n === "Kevin Li",
  type: s2 === "Ahmedabad" ? "Partner" : "Employee",
  access: n === ME.name || n === "Adam Royce" ? "Administrator" : k % 11 === 0 ? "View only" : "Standard user",
  div: g.startsWith("AG") ? "AG" : g.startsWith("Construction") ? "CO" : "Both",
}));
const inGroup = (g: any, site?: any) => PEOPLE.filter((p: any) => p.g === g && (!site || p.s === site)).map((p: any) => p.n);

export { SITES, GROUPS, NAMES, PEOPLE, inGroup }


