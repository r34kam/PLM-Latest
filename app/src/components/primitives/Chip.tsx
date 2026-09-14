
/* ============================ PRIMITIVES ============================ */

const Chip = ({ k = "gray", children, icon: Ic }: any) => (
  <span className={`chip c-${k}`}>{Ic && <Ic size={11} />}{children}</span>
);
const stageChip = (s: any) => {
  const m: Record<string, string> = {
    Open: "slate", Submit: "blue", Approval: "warn", Effective: "vio",
    Complete: "ok", Rejected: "bad",
  };
  return <Chip k={m[s] || "gray"}>{s}</Chip>;
};
const phaseChip = (p: any) => {
  const m: Record<string, string> = { "In Production": "ok", Discontinued: "warn", Obsolete: "bad", Prototype: "teal", Design: "slate" };
  return <Chip k={m[p] || "gray"}>{p}</Chip>;
};

export { Chip, stageChip, phaseChip }


