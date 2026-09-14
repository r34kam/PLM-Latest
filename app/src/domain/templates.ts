
const ECO_TEMPLATE = [
  "Item number,New phase,New revision,Inventory disposition,Notes",
  "1003140-01,In Production,C,N/A,Update kit for CG-1 mounting",
  "01-080401-03,Obsolete,IA,Scrap,Inactivate — EOL",
  "04-080401-10,Obsolete,IA,Scrap,Unique child of 01-080401-03",
].join("\n");
const ITEM_TEMPLATE = [
  "Item number,Item name,Category,Revision,Lifecycle phase,Owner,Unit of measure,Procurement type,Plant,Material status,Material group,RoHS compliant",
  "AUTO,KIT TS CG MOUNTING,KIT,A,Design,Steve Howe,EA,Made-to-Specification (MTS),1210 – TPS Livermore,10 – NEW,002 – Construction,Yes",
].join("\n");

export { ECO_TEMPLATE, ITEM_TEMPLATE }


