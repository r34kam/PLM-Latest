import { FileUploadModal } from '@/components/data-io/FileUpload'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { SpecList } from '@/components/primitives/SpecList'
import { Tabs } from '@/components/primitives/Tabs'
import { BomItem, useBomItemsByKit, useCreateBomItem, useDeleteBomItem, useUpdateBomItem } from '@/data/bomItems'
import { useAllItems, useItemByPn } from '@/data/items'
import { BOM_1003140, bomFor, whereUsed } from '@/domain/boms'
import { ITEMS } from '@/domain/catalog'
import { STATUS_CHIP, complianceFor } from '@/domain/compliance'
import { PART_SUPPLIERS } from '@/domain/suppliers'
import { T } from '@/theme/tokens'
import { Ban, Bell, CheckCircle2, ChevronRight, FileText, Layers, Link2, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, Upload, Users, X } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'

function ItemDetail({ id, go, initialTab, renderHeaderActions }: { id: any; go: any; initialTab?: string; renderHeaderActions?: () => React.ReactNode }) {
  // Load item from backend by part number; fall back to the static ITEMS array for
  // walkthrough data that depends on relationships not yet stored in the backend.
  const itemFromBackend = useItemByPn(id);
  const it = itemFromBackend ?? ITEMS.find((x: any) => x.pn === id) ?? ITEMS[0];
  const isKit = it.cat === "KIT" || it.cat === "ASSEMBLY";

  // Backend BOM items for KIT items
  const { bomItems: backendBomItemsRaw, loading: bomLoading } = useBomItemsByKit(it.pn);
  // Retain the last non-empty set so the table never flashes blank during a background
  // refetch that happens immediately after a create/delete mutation.
  const stableBomItemsRef = React.useRef<BomItem[]>([]);
  if (backendBomItemsRaw.length > 0) stableBomItemsRef.current = backendBomItemsRaw;
  const backendBomItems = backendBomItemsRaw.length > 0 ? backendBomItemsRaw : stableBomItemsRef.current;

  const createBomItem = useCreateBomItem();
  const updateBomItem = useUpdateBomItem();
  const deleteBomItem = useDeleteBomItem();

  // Edit BOM item modal state
  const [editBomItem, setEditBomItem] = useState<{ id: string; pn: string; name: string; cat: string; kitNumber: string; addedAt: string; qty: string; uom: string; refDes: string; notes: string } | null>(null);
  const [editBomSaving, setEditBomSaving] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<BomItem | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const handleEditBomItem = async () => {
    if (!editBomItem) return;
    setEditBomSaving(true);
    try {
      // Send the FULL record payload so a replace-style backend doesn't wipe
      // fields like kitNumber / pn / name that aren't in the edit form.
      await updateBomItem(editBomItem.id, {
        kitNumber: editBomItem.kitNumber,
        pn: editBomItem.pn,
        name: editBomItem.name,
        cat: editBomItem.cat,
        addedAt: editBomItem.addedAt,
        qty: `${editBomItem.qty} ${editBomItem.uom}`,
        uom: editBomItem.uom,
        refDes: editBomItem.refDes.trim(),
        notes: editBomItem.notes.trim(),
      });
      toast.success(`${editBomItem.pn} updated`);
      setEditBomItem(null);
    } catch {
      toast.error("Failed to update BOM item");
    } finally {
      setEditBomSaving(false);
    }
  };

  const handleConfirmedDelete = async () => {
    if (!deleteConfirmItem) return;
    setDeleteSaving(true);
    try {
      await deleteBomItem(deleteConfirmItem.id);
      toast.success(`${deleteConfirmItem.pn} removed from BOM`);
      setDeleteConfirmItem(null);
    } catch {
      toast.error("Failed to remove BOM item");
    } finally {
      setDeleteSaving(false);
    }
  };

  // All items catalogue for the picker dropdown
  const { data: allItemsRaw } = useAllItems();

  // Parse BOM lines: prefer backend bomLines, fall back to static BOMS for old items
  const backendBomLines = React.useMemo(() => {
    try { return JSON.parse((it as any).bomLines || "[]"); } catch { return []; }
  }, [(it as any).bomLines]);
  // For the walkthrough item 1003140-01 we keep the exact BOM_1003140 data
  const bomChildren = it.pn === "1003140-01"
    ? BOM_1003140.filter((b: any) => b.st !== "del")
    : (backendBomLines.length > 0 ? backendBomLines : bomFor(it.pn));

  // BOM item add modal state — now uses item picker
  const [bomItemModal, setBomItemModal] = useState<{
    selectedPn: string; selectedName: string; selectedCat: string;
    qty: string; uom: string; refDes: string; notes: string;
    pickerQuery: string; showPicker: boolean;
    csvMode: boolean;
  } | null>(null);
  const [bomItemSaving, setBomItemSaving] = useState(false);

  const openBomItemModal = () => { setBomItemModal({
    selectedPn: "", selectedName: "", selectedCat: "HARDWARE",
    qty: "1", uom: "EA", refDes: "", notes: "",
    pickerQuery: "", showPicker: false, csvMode: false,
  }); };

  const handleAddBomItem = async () => {
    if (!bomItemModal || !bomItemModal.selectedPn.trim()) return;
    setBomItemSaving(true);
    try {
      await createBomItem({
        kitNumber: it.pn,
        pn: bomItemModal.selectedPn.trim(),
        name: bomItemModal.selectedName.trim(),
        cat: bomItemModal.selectedCat,
        qty: `${bomItemModal.qty} ${bomItemModal.uom}`,
        uom: bomItemModal.uom,
        refDes: bomItemModal.refDes.trim(),
        notes: bomItemModal.notes.trim(),
        addedAt: new Date().toISOString().split("T")[0],
      });
      toast.success(`${bomItemModal.selectedPn} added to BOM`);
      setBomItemModal(null);
    } catch {
      toast.error("Failed to add BOM item — please try again");
    } finally {
      setBomItemSaving(false);
    }
  };

  const handleCsvBomImport = async (text: string) => {
    if (!bomItemModal) return;
    const lines = text.trim().split("\n").slice(1); // skip header
    if (!lines.length) { toast.error("No data rows found in CSV"); return; }
    setBomItemSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const rows = lines.map((line: any) => {
        const cols = line.split(",").map((c: any) => c.trim().replace(/^"|"$/g, ""));
        return { pn: cols[0] ?? "", name: cols[1] ?? "", cat: cols[2] ?? "HARDWARE", qty: cols[3] ?? "1", uom: cols[4] ?? "EA", notes: cols[5] ?? "" };
      }).filter((r: any) => r.pn && r.name);
      await Promise.all(rows.map((r: any) => createBomItem({
        kitNumber: it.pn, pn: r.pn, name: r.name, cat: r.cat,
        qty: `${r.qty} ${r.uom}`, uom: r.uom, refDes: "", notes: r.notes, addedAt: today,
      })));
      toast.success(`${rows.length} items imported from CSV`);
      setBomItemModal(null);
    } catch {
      toast.error("CSV import failed — check the format and try again");
    } finally {
      setBomItemSaving(false);
    }
  };





  const [tab, setTab] = useState(initialTab || "Spec");
  const [bomSub, setBomSub] = useState("BOM");
  const [fileModal, setFileModal] = useState(false);
  const [compSub, setCompSub] = useState("Requirements");
  const TABS = ["Spec", "BOM", "Files", "Sourcing", "Compliance", "Where used", "Notifications", "History"];
  return (
    <div className="stack" data-test-id="item-detail-page">
      <div>
        <div className="crumb"><a onClick={() => go({ page: "items" })}>Items</a><ChevronRight size={11} />{it.pn}</div>
        <div className="bet">
          <div className="row" style={{ gap: 10 }}>
            <h1>{it.pn}</h1>{phaseChip(it.phase)}
            <span className="sub">{it.name} · rev {it.rev}</span>
          </div>
          <div className="row">
            <button className="btn dan" onClick={() => go({ page: "inactivate", id: it.pn })}><Ban size={13} strokeWidth={2} />Mark inactive</button>
            {renderHeaderActions?.()}
          </div>
        </div>
      </div>
      <div className="card" style={{ padding: "9px 14px" }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="mini">Working revision</span>
          <Chip k="warn">Modified · shared · 2 views locked</Chip>
          <span className="mini">Open changes: <a className="pn" onClick={() => go({ page: "eco", id: "ECO-011420" })}>ECO-011420</a></span>
          <span className="mini" style={{ marginLeft: "auto" }}>Created {it.created} · owner {it.owner}</span>
        </div>
      </div>

      <Card pad={false}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ padding: 16 }}>
          {tab === "Spec" && (
            <div className="grid2">
              <div>
                <h3 style={{ marginBottom: 8 }}>Basic information</h3>
                <SpecList rows={[["Category", it.cat], ["Item number", it.pn], ["Revision", it.rev], ["Item name", it.name],
                  ["Lifecycle phase", it.phase], ["Assembly type", "Highest accessible assembly"], ["Primary file", "None specified"],
                  ["Owner", it.owner], ["Procurement type", it.proc], ["Unit of measure", it.uom], ["Created on", it.created]]} />
              </div>
              <div>
                <h3 style={{ marginBottom: 8 }}>SAP attributes</h3>
                <SpecList rows={[["Import to ERP system?", "SAP"],
                  ["Material status", <Chip k={it.status.startsWith("50") ? "bad" : "ok"} key="s">{it.status}</Chip>],
                  ["BOM usage", it.bom ? "Production" : "N/A"], ["Plant", it.plant]]} />
                <h3 style={{ margin: "16px 0 8px" }}>Additional attributes</h3>
                <SpecList rows={[["Material group", it.mg], ["RoHS compliant", it.rohs]]} />
                <h3 style={{ margin: "16px 0 8px" }}>Cost</h3>
                <SpecList rows={[["Prototype cost", "—"], ["Production cost", "—"]]} />
              </div>
            </div>
          )}

          {tab === "BOM" && (
            <div className="stack">
              <div className="seg" style={{ marginBottom: 2 }}>
                {["BOM", "Costing", "BOM history"].map((x: any) => (
                  <button key={x} type="button" className={bomSub === x ? "on" : ""} onClick={() => setBomSub(x)}>{x}</button>
                ))}
              </div>

              {bomSub === "BOM" && (
                <>
                  {/* Header row with Add button for KIT/ASSEMBLY items */}
                  <div className="bet" style={{ marginBottom: 4 }} data-test-id="bom-tab-header">
                    <div className="sub">
                      {isKit
                        ? (backendBomItems.length > 0
                            ? `${backendBomItems.length} BOM line${backendBomItems.length === 1 ? "" : "s"} · ${new Set(backendBomItems.map((b: any) => b.pn)).size} unique parts`
                            : bomChildren.length > 0
                              ? `Contains ${bomChildren.length} first-level items (legacy BOM)`
                              : "No BOM lines yet — add items below.")
                        : (bomChildren.length > 0
                            ? `Contains ${bomChildren.length} first-level item${bomChildren.length === 1 ? "" : "s"}, ${new Set(bomChildren.map((b: any) => b.pn)).size} unique.`
                            : "This is a component — no bill of materials.")}
                    </div>
                    {isKit && (
                      <button
                        type="button"
                        className="btn sm"
                        data-test-id="add-bom-item-btn"
                        onClick={openBomItemModal}
                      >
                        <Plus size={12} />Add item
                      </button>
                    )}
                  </div>

                  {/* Backend BOM items (for KIT/ASSEMBLY) */}
                  {isKit ? (
                    bomLoading ? (
                      <div className="sub" style={{ padding: "12px 0" }} data-test-id="bom-items-loading">Loading BOM…</div>
                    ) : backendBomItems.length > 0 ? (
                      <table className="tbl" data-test-id="bom-items-table">
                        <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Category</th><th>Qty</th><th>Ref. Des.</th><th>Notes</th><th></th></tr></thead>
                        <tbody>
                          {backendBomItems.map((b: any, k: any) => (
                            <tr key={b.id} data-test-id={`bom-item-row-${b.id}`}>
                              <td>{k + 1}</td>
                              <td><a className="pn" onClick={() => go({ page: "item", id: b.pn })}>{b.pn}</a></td>
                              <td>{b.name}</td>
                              <td className="sub">{b.cat}</td>
                              <td>{b.qty}</td>
                              <td className="sub">{b.refDes || "—"}</td>
                              <td className="sub" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.notes || "—"}</td>
                              <td style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <button
                                  type="button"
                                  className="iconbtn"
                                  data-test-id={`edit-bom-item-${b.id}`}
                                  title="Edit BOM line"
                                  onClick={() => {
                                    const [qty, uom] = b.qty.split(" ");
                                    setEditBomItem({ id: b.id, pn: b.pn, name: b.name, cat: b.cat, kitNumber: b.kitNumber, addedAt: b.addedAt, qty: qty || "1", uom: uom || b.uom || "EA", refDes: b.refDes, notes: b.notes });
                                  }}
                                >
                                  <Pencil size={13} />
                                </button>
                                <button
                                  type="button"
                                  className="iconbtn"
                                  data-test-id={`remove-bom-item-${b.id}`}
                                  title="Remove from BOM"
                                  onClick={() => setDeleteConfirmItem(b)}
                                  style={{ color: T.bad }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : bomChildren.length > 0 ? (
                      /* fallback to legacy static BOM data */
                      <table className="tbl" data-test-id="bom-legacy-table">
                        <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Category</th><th>Phase</th><th>Qty</th></tr></thead>
                        <tbody>
                          {bomChildren.map((b: any, k: number) => (
                            <tr key={b.pn + k}>
                              <td>{k + 1}</td>
                              <td><a className="pn" onClick={() => go({ page: "item", id: b.pn })}>{b.pn}{b.rev ? ` rev ${b.rev}` : ""}</a></td>
                              <td>{b.name}</td>
                              <td className="sub">{b.cat}</td>
                              <td>{phaseChip(b.phase)}</td>
                              <td>{b.qty || "1 EA"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <Empty icon={Layers} title="No BOM items" body="This kit has no BOM lines yet. Use Add item to build the bill of materials." action={<button className="btn" onClick={openBomItemModal}><Plus size={13} />Add first item</button>} />
                    )
                  ) : (
                    /* Non-kit legacy BOM */
                    bomChildren.length === 0
                      ? <Empty icon={Layers} title="No BOM" body="This item has no child components." />
                      : (
                        <table className="tbl" data-test-id="bom-children-table">
                          <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Category</th><th>Phase</th><th>Qty</th></tr></thead>
                          <tbody>
                            {bomChildren.map((b: any, k: number) => (
                              <tr key={b.pn + k}>
                                <td>{k + 1}</td>
                                <td><a className="pn" onClick={() => go({ page: "item", id: b.pn })}>{b.pn}{b.rev ? ` rev ${b.rev}` : ""}</a></td>
                                <td>{b.name}</td>
                                <td className="sub">{b.cat}</td>
                                <td>{phaseChip(b.phase)}</td>
                                <td>{b.qty || "1 EA"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                  )}
                </>
              )}

              {bomSub === "Costing" && (
                <>
                  <div className="sub">Standard cost rollup from first-level BOM children.</div>
                  {bomChildren.length === 0
                    ? <Empty icon={Layers} title="No cost rollup" body="Component items carry unit cost only." />
                    : (
                      <table className="tbl">
                        <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Qty</th><th style={{ textAlign: "right" }}>Unit cost</th><th style={{ textAlign: "right" }}>Extended cost</th></tr></thead>
                        <tbody>
                          {bomChildren.map((b: any, k: any) => {
                            const qty = parseInt(b.qty || "1", 10) || 1;
                            const unit = parseFloat(b.cost || "0");
                            const ext = (qty * unit).toFixed(2);
                            return (
                              <tr key={b.pn + k}>
                                <td>{k + 1}</td>
                                <td><a className="pn" onClick={() => go({ page: "item", id: b.pn })}>{b.pn}</a></td>
                                <td>{b.name}</td>
                                <td>{b.qty || "1 EA"}</td>
                                <td style={{ textAlign: "right" }}>${unit.toFixed(2)}</td>
                                <td style={{ textAlign: "right" }}>${ext}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 600 }}>
                            <td colSpan={5} style={{ textAlign: "right" }}>Total standard cost</td>
                            <td style={{ textAlign: "right" }}>
                              ${bomChildren.reduce((sum: any, b: any) => {
                                const qty = parseInt(b.qty || "1", 10) || 1;
                                return sum + qty * parseFloat(b.cost || "0");
                              }, 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                </>
              )}

              {bomSub === "BOM history" && (
                <>
                  <div className="sub">Change orders that modified this item's bill of materials.</div>
                  {it.pn === "1003140-01" ? (
                    <table className="tbl">
                      <thead><tr><th>Change order</th><th>Description</th><th>Effective date</th><th>Rev</th><th>Changed by</th></tr></thead>
                      <tbody>
                        <tr>
                          <td><a className="pn" onClick={() => go({ page: "eco", id: "ECO-011420" })}>ECO-011420</a></td>
                          <td>Add 1006394-01 Washer Flat M5 · Add 2505-0103 Screw M5 · Remove 9060-1319 VHB Tape</td>
                          <td>09/09/2026</td><td>B → C</td><td>Wendy Veth</td>
                        </tr>
                        <tr>
                          <td><a className="pn" onClick={() => go({ page: "eco", id: "ECO-010420" })}>ECO-010420</a></td>
                          <td>Initial BOM creation — 3 hardware components and 2 brackets added</td>
                          <td>08/01/2013</td><td>— → A</td><td>Steve Howe</td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <Empty icon={FileText} title="No BOM history" body="No change orders have modified this item's bill of materials yet." />
                  )}
                </>
              )}
            </div>
          )}

          {tab === "Files" && (
            <div className="stack">
              <div className="bet">
                <div><h3>Files on this item</h3>
                  <div className="sub" style={{ marginTop: 3 }}>Drawings, specifications and certificates. The primary file is what
                    suppliers see first.</div></div>
                <button className="btn pri" onClick={() => setFileModal(true)}><Upload size={13} />Attach files</button>
              </div>
              <Empty icon={FileText} title="No files on this item"
                body="Sales BOMs do not carry drawings. Files appear here for made-to-print and made-to-specification items." />
            </div>
          )}

          {tab === "Sourcing" && <Empty icon={Link2} title="No sourcing records"
            body="This kit is assembled in house. Sourcing records and supplier items are held on the components."
            action={<button className="btn"><Plus size={13} />Add supplier item</button>} />}

          {tab === "Compliance" && (() => {
            const sub = compSub;
            return (
              <div className="stack">
                <div className="seg">
                  {["Requirements", "Compliance BOM", "Potential compliance BOM"].map((x: any) => (
                    <button key={x} className={sub === x ? "on" : ""} onClick={() => setCompSub(x)}>{x}</button>
                  ))}
                </div>

                {sub === "Requirements" && (() => {
                  const reqs = complianceFor(it.pn);
                  const adminCount = reqs.filter((r: any) => !["RoHS"].includes(r.mark)).length;
                  const sysCount = reqs.filter((r: any) => r.mark === "RoHS").length;
                  return (<>
                    <div className="sub">{sysCount} system-defined compliance requirement{sysCount !== 1 ? "s" : ""} applied · {adminCount} admin-defined requirement{adminCount !== 1 ? "s" : ""} applied</div>
                    <div className="card" style={{ overflow: "hidden" }}>
                      <table className="tbl">
                        <thead><tr><th>#</th><th>Name</th><th>Status</th><th>Rationale</th><th>Mark</th><th>Evidence</th><th>Last modified</th></tr></thead>
                        <tbody>
                          {reqs.map((req: any, idx: any) => {
                            const chip = STATUS_CHIP[req.status as keyof typeof STATUS_CHIP];
                            return (
                              <tr key={req.name}>
                                <td>{idx + 1}</td>
                                <td style={{ fontWeight: 600 }}>{req.name}</td>
                                <td><Chip k={chip.k} icon={req.status === "Compliant" ? ShieldCheck : undefined}>{chip.label}</Chip></td>
                                <td className="sub">{req.rationale}</td>
                                <td>{req.mark}</td>
                                <td className="sub">{req.evidence}</td>
                                <td className="sub">{req.modifier}<br />{req.lastModified}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>);
                })()}

                {sub === "Compliance BOM" && (<>
                  <div className="sub">Every component that contributes to this item’s compliance status, with the evidence behind it.</div>
                  <div className="card" style={{ overflow: "hidden" }}>
                    <table className="tbl">
                      <thead><tr><th>Item number</th><th>Item name</th><th>Level</th><th>RoHS</th><th>Conflict minerals</th><th>Evidence</th><th>Expires</th></tr></thead>
                      <tbody>
                        {BOM_1003140.filter((b2: any) => b2.st !== "del").map((b2: any, k: any) => (
                          <tr key={b2.pn}>
                            <td className="pn">{b2.pn}</td><td>{b2.name}</td><td className="sub">Level 1</td>
                            <td><Chip k="ok" icon={ShieldCheck}>Compliant</Chip></td>
                            <td>{k === 2 ? <Chip k="warn">Declaration pending</Chip> : <Chip k="ok">Conflict free</Chip>}</td>
                            <td className="sub">{k === 2 ? "None on file" : "Supplier declaration"}</td>
                            <td className="sub">{k === 2 ? <span className="mut">—</span> : "31 Dec 2027"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="okbox"><CheckCircle2 size={15} />
                    <div><b>Top level is compliant.</b> All five components carry a valid RoHS declaration. One conflict minerals
                      declaration is outstanding but is not required for RoHS status.</div></div>
                </>)}

                {sub === "Potential compliance BOM" && (<>
                  <div className="sub">What the compliance picture becomes if the working revision is released as it stands.</div>
                  <div className="card" style={{ overflow: "hidden" }}>
                    <table className="tbl">
                      <thead><tr><th>Item number</th><th>Item name</th><th>Change</th><th>RoHS</th><th>Effect on top level</th></tr></thead>
                      <tbody>
                        {BOM_1003140.map((b2: any) => (
                          <tr key={b2.pn}>
                            <td className={b2.st === "del" ? "del" : "pn"}>{b2.pn}</td>
                            <td className={b2.st === "del" ? "del" : b2.st === "add" ? "add" : ""}>{b2.name}</td>
                            <td>{b2.st === "add" ? <Chip k="ok">Added</Chip> : b2.st === "del" ? <Chip k="bad">Removed</Chip> : <span className="mut">Unchanged</span>}</td>
                            <td><Chip k="ok">Compliant</Chip></td>
                            <td className="sub">{b2.st === "add" ? "No change — supplier declaration already on file"
                              : b2.st === "del" ? "Removes one declaration dependency" : "No change"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="note">Releasing revision C keeps the item RoHS compliant. No new evidence is needed before this change
                    can go effective.</div>
                </>)}
              </div>
            );
          })()}

          {tab === "Where used" && (() => {
            const parents = whereUsed(it.pn);
            return (
              <div className="stack">
                <div className="sub">{parents.length
                  ? `Used in ${parents.length} parent assembl${parents.length === 1 ? "y" : "ies"}. This drives the unique-parts result when the item is inactivated.`
                  : "Not used on any parent assembly. Inactivating this item orphans nothing."}</div>
                {parents.length === 0 ? <Empty icon={Layers} title="Top-level item"
                  body="Nothing above this in any bill of materials." /> : (
                  <div className="card" style={{ overflow: "hidden" }}>
                    <table className="tbl">
                      <thead><tr><th>Parent item</th><th>Name</th><th>Category</th><th>Qty</th><th>Phase</th><th>Division</th></tr></thead>
                      <tbody>
                        {parents.map((pa: any) => (
                          <tr key={pa.pn}>
                            <td><a className="pn" onClick={() => go({ page: "item", id: pa.pn })}>{pa.pn}</a></td>
                            <td>{pa.name}</td><td className="sub">{pa.cat}</td>
                            <td>{(bomFor(pa.pn).find((x: any) => x.pn === it.pn) || {}).qty || "1 EA"}</td>
                            <td>{phaseChip(pa.phase)}</td><td><Chip k={pa.div === "AG" ? "teal" : "blue"}>{pa.div}</Chip></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}

          {tab === "Supplier access" && (
            <div className="stack">
              <div className="bet">
                <div><h3>Suppliers who can view this revision</h3>
                  <div className="sub" style={{ marginTop: 3 }}>Granting access on an assembly asks whether the supplier also sees its BOM, or the assembly alone.</div></div>
                <button className="btn">Share with suppliers</button>
              </div>
              {(PART_SUPPLIERS[it.pn] || []).length ? (
                <div className="card" style={{ overflow: "hidden" }}>
                  <table className="tbl">
                    <thead><tr><th>Supplier</th><th>Access type</th><th>Sees the BOM</th><th>Notified on</th></tr></thead>
                    <tbody>
                      {(PART_SUPPLIERS[it.pn] || []).map((sp: any) => (
                        <tr key={sp}><td style={{ fontWeight: 600 }}>{sp}</td>
                          <td><Chip k="ok">Sourced directly</Chip></td>
                          <td>{it.bom > 0 ? <Chip k="blue">Yes</Chip> : <span className="mut">No BOM</span>}</td>
                          <td className="sub">Change complete</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty icon={Users} title="Not shared with any supplier"
                  body="To appear here, this revision must be shared and sourced directly to a supplier with supplier access to this workspace." />
              )}
            </div>
          )}

          {tab === "Notifications" && (
            <div className="stack">
              <div className="seg">
                <button type="button" className="on">Subscribers</button>
                <button type="button">My subscription</button>
                <button type="button">Supplier subscriptions</button>
              </div>
              <Empty icon={Bell} title="No subscribers on this item"
                body="Employees, partners and suppliers listed here are notified when a new revision of this item is released."
                action={<button className="btn">Subscribe</button>} />
            </div>
          )}

          {tab === "History" && (
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 170 }}>When</th><th style={{ width: 180 }}>Who</th><th>Activity</th></tr></thead>
                <tbody>
                  {[["09/09/2026 09:12 AM", "Wendy Veth", "Working revision C created via ECO-011420"],
                    ["04/11/2024 02:40 PM", "Steve Howe", "Revision B released via ECO-009117"],
                    ["04/11/2024 02:31 PM", "Steve Howe", "BOM line added: 1005393-01, qty 4"],
                    ["11/02/2019 10:05 AM", "Kathleen Whitten", "Material status set to 20 – ACTIVE, pushed to SAP"],
                    ["08/01/2013 02:13 PM", "Kathleen Whitten", "Item created"]].map((h: any, k: any) => (
                    <tr key={k}><td className="sub">{h[0]}</td><td style={{ fontWeight: 600 }}>{h[1]}</td><td>{h[2]}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <FileUploadModal
        open={fileModal}
        onClose={() => setFileModal(false)}
        context="this item"
      />

      {/* ---- Add BOM Item modal — item picker + CSV upload ---- */}
      {bomItemModal && (() => {
        const catalogueItems = (allItemsRaw ?? []).concat(ITEMS as any[]);
        // Deduplicate by pn
        // Already-added PNs — exclude from picker to prevent duplicates
        const addedPns = new Set(backendBomItems.map((b: any) => b.pn));
        const seenPns = new Set<string>();
        const pickerItems = catalogueItems.filter((i: any) => {
          if (seenPns.has(i.pn)) return false;
          if (addedPns.has(i.pn)) return false;
          if (i.pn === it.pn) return false;
          seenPns.add(i.pn);
          return true;
        });
        const q = bomItemModal.pickerQuery.toLowerCase();
        const filtered = q
          ? pickerItems.filter((i: any) => (i.pn + " " + i.name).toLowerCase().includes(q)).slice(0, 20)
          : pickerItems.slice(0, 12);

        return (
          <Modal
            title={`Add item to BOM — ${it.pn}`}
            wide
            onClose={() => !bomItemSaving && setBomItemModal(null)}
            foot={<>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`btn sm ${bomItemModal.csvMode ? "on" : ""}`}
                  data-test-id="bom-csv-toggle"
                  onClick={() => setBomItemModal({ ...bomItemModal, csvMode: !bomItemModal.csvMode })}
                >
                  <Upload size={12} />CSV import
                </button>
              </div>
              <button className="btn" style={{ marginLeft: "auto" }} disabled={bomItemSaving} onClick={() => setBomItemModal(null)}>Cancel</button>
              {!bomItemModal.csvMode && (
                <button
                  className="btn pri"
                  data-test-id="save-bom-item-btn"
                  disabled={bomItemSaving || !bomItemModal.selectedPn.trim()}
                  onClick={handleAddBomItem}
                >
                  {bomItemSaving ? <Loader2 size={13} className="spin" /> : <Plus size={13} />}
                  Add to BOM
                </button>
              )}
            </>}
          >
            {bomItemModal.csvMode ? (
              /* ---- CSV upload mode ---- */
              <div data-test-id="bom-csv-panel">
                <input
                  id="bom-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  style={{ display: "none" }}
                  data-test-id="bom-csv-file-input"
                  onChange={(e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev: any) => {
                      const text = ev.target?.result as string;
                      if (text) handleCsvBomImport(text);
                    };
                    reader.readAsText(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="drop"
                  data-test-id="bom-csv-dropzone"
                  disabled={bomItemSaving}
                  style={{ padding: "48px 32px" }}
                  onClick={() => document.getElementById("bom-csv-file")?.click()}
                  onDragOver={(e: any) => e.preventDefault()}
                  onDrop={(e: any) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev: any) => {
                      const text = ev.target?.result as string;
                      if (text) handleCsvBomImport(text);
                    };
                    reader.readAsText(file);
                  }}
                  aria-label="Upload CSV file"
                >
                  {bomItemSaving ? (
                    <Loader2 size={28} className="spin" style={{ margin: "0 auto", color: T.brand }} />
                  ) : (
                    <span style={{ width: 52, height: 52, borderRadius: 14, background: T.b50, display: "grid", placeItems: "center", margin: "0 auto" }}>
                      <Upload size={22} color={T.brand} />
                    </span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 15, marginTop: 14 }}>
                    {bomItemSaving ? "Importing…" : "Drop your CSV here, or click to browse"}
                  </div>
                  <div className="sub" style={{ marginTop: 6 }}>
                    One row per component · columns in order:
                  </div>
                  <code style={{ display: "inline-block", marginTop: 8, fontSize: 12, background: T.b25, border: `1px solid ${T.b100}`, padding: "4px 10px", borderRadius: 6, color: T.b700, letterSpacing: 0 }}>
                    PartNumber, Name, Category, Qty, UOM, Notes
                  </code>
                  <div className="mini" style={{ marginTop: 8, color: T.g400 }}>
                    e.g. 1006394-01, WASHER FLAT M5, HARDWARE, 4, EA, Zinc-plated
                  </div>
                </button>
              </div>
            ) : (
              /* ---- Item picker mode ---- */
              <div className="stack" data-test-id="bom-item-picker">
                {/* Search */}
                <div style={{ position: "relative" }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.g500, pointerEvents: "none" }} />
                  <Input
                    value={bomItemModal.pickerQuery}
                    autoFocus
                    placeholder="Search by part number or name…"
                    data-test-id="bom-item-search-input"
                    style={{ paddingLeft: 30 }}
                    onChange={(e: any) => setBomItemModal({ ...bomItemModal, pickerQuery: e.target.value, showPicker: true })}
                  />
                </div>

                {/* Selected item display */}
                {bomItemModal.selectedPn && (
                  <div style={{ background: T.b25, border: `1px solid ${T.b200}`, borderRadius: 8, padding: "10px 14px" }} data-test-id="bom-selected-item">
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{bomItemModal.selectedPn}</div>
                        <div className="sub">{bomItemModal.selectedName} · {bomItemModal.selectedCat}</div>
                      </div>
                      <button type="button" className="iconbtn" onClick={() => setBomItemModal({ ...bomItemModal, selectedPn: "", selectedName: "", selectedCat: "HARDWARE" })}>
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Picker list */}
                {!bomItemModal.selectedPn && (
                  <div style={{ border: `1px solid ${T.g200}`, borderRadius: 8, overflow: "hidden", maxHeight: 240, overflowY: "auto" }} data-test-id="bom-item-picker-list">
                    {filtered.length === 0 ? (
                      <div style={{ padding: "12px 14px", color: T.g500, fontSize: 13 }}>No items match "{bomItemModal.pickerQuery}"</div>
                    ) : filtered.map((item: any) => (
                      <button
                        key={item.pn}
                        type="button"
                        data-test-id={`bom-picker-item-${item.pn}`}
                        style={{ display: "flex", width: "100%", padding: "9px 14px", gap: 12, textAlign: "left", background: "transparent", borderBottom: `1px solid ${T.g100}`, cursor: "pointer" }}
                        onClick={() => setBomItemModal({
                          ...bomItemModal,
                          selectedPn: item.pn,
                          selectedName: item.name,
                          selectedCat: item.cat,
                          pickerQuery: "",
                        })}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{item.pn}</div>
                          <div style={{ fontSize: 12, color: T.g600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                        </div>
                        <Chip k={item.cat === "KIT" ? "blue" : item.cat === "ASSEMBLY" ? "teal" : "gray"}>{item.cat}</Chip>
                      </button>
                    ))}
                  </div>
                )}

                {/* Qty + details once item selected */}
                {bomItemModal.selectedPn && (
                  <div className="grid2">
                    <Field label="Quantity">
                      <div className="row" style={{ gap: 6 }}>
                        <Input
                          value={bomItemModal.qty}
                          style={{ width: 80 }}
                          data-test-id="bom-item-qty-input"
                          onChange={(e: any) => setBomItemModal({ ...bomItemModal, qty: e.target.value })}
                        />
                        <Select
                          value={bomItemModal.uom}
                          options={["EA", "M", "KG", "L"]}
                          style={{ width: 80 }}
                          data-test-id="bom-item-uom-select"
                          onChange={(e: any) => setBomItemModal({ ...bomItemModal, uom: e.target.value })}
                        />
                      </div>
                    </Field>
                    <Field label="Reference designator" hint="Optional — PCB only">
                      <Input
                        value={bomItemModal.refDes}
                        placeholder="e.g. H1"
                        data-test-id="bom-item-refdes-input"
                        onChange={(e: any) => setBomItemModal({ ...bomItemModal, refDes: e.target.value })}
                      />
                    </Field>
                    <Field label="Assembly notes" hint="Spans both columns">
                      <Input
                        value={bomItemModal.notes}
                        placeholder="e.g. Torque to 2.5 Nm"
                        data-test-id="bom-item-notes-input"
                        onChange={(e: any) => setBomItemModal({ ...bomItemModal, notes: e.target.value })}
                      />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* Edit BOM item modal */}
      {editBomItem && (
        <Modal
          title={`Edit BOM line — ${editBomItem.pn}`}
          onClose={() => setEditBomItem(null)}
          data-test-id="edit-bom-item-modal"
        >
          <div className="stack" style={{ gap: 14, paddingTop: 4 }}>
            <div style={{ fontSize: 13, color: T.g500 }}>
              <span style={{ fontWeight: 600, color: T.g900 }}>{editBomItem.pn}</span> — {editBomItem.name}
            </div>
            <Field label="Quantity">
              <div className="row" style={{ gap: 8 }}>
                <Input
                  type="number"
                  min={1}
                  value={editBomItem.qty}
                  data-test-id="edit-bom-item-qty-input"
                  style={{ width: 80 }}
                  onChange={(e: any) => setEditBomItem({ ...editBomItem, qty: e.target.value })}
                />
                <Select
                  value={editBomItem.uom}
                  options={["EA", "M", "KG", "L"]}
                  style={{ width: 80 }}
                  data-test-id="edit-bom-item-uom-select"
                  onChange={(e: any) => setEditBomItem({ ...editBomItem, uom: e.target.value })}
                />
              </div>
            </Field>
            <Field label="Reference designator" hint="Optional — PCB only">
              <Input
                value={editBomItem.refDes}
                placeholder="e.g. H1"
                data-test-id="edit-bom-item-refdes-input"
                onChange={(e: any) => setEditBomItem({ ...editBomItem, refDes: e.target.value })}
              />
            </Field>
            <Field label="Assembly notes">
              <Input
                value={editBomItem.notes}
                placeholder="Optional notes"
                data-test-id="edit-bom-item-notes-input"
                onChange={(e: any) => setEditBomItem({ ...editBomItem, notes: e.target.value })}
              />
            </Field>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn gh" type="button" onClick={() => setEditBomItem(null)} data-test-id="edit-bom-cancel-btn">Cancel</button>
              <button
                className="btn pri"
                type="button"
                disabled={editBomSaving || !editBomItem.qty}
                data-test-id="edit-bom-save-btn"
                onClick={handleEditBomItem}
              >
                {editBomSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirmItem && (
        <Modal
          title="Remove from BOM?"
          onClose={() => !deleteSaving && setDeleteConfirmItem(null)}
          data-test-id="delete-bom-confirm-modal"
          foot={<>
            <button className="btn gh" type="button" disabled={deleteSaving} onClick={() => setDeleteConfirmItem(null)} data-test-id="delete-bom-cancel-btn">Cancel</button>
            <button className="btn dan" type="button" disabled={deleteSaving} onClick={handleConfirmedDelete} data-test-id="delete-bom-confirm-btn">
              {deleteSaving ? "Removing…" : "Remove"}
            </button>
          </>}
        >
          <div style={{ padding: "8px 0", fontSize: 14 }} data-test-id="delete-bom-confirm-body">
            Remove <strong>{deleteConfirmItem.pn}</strong> — {deleteConfirmItem.name} from the BOM?
            <div className="sub" style={{ marginTop: 6 }}>This cannot be undone.</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export { ItemDetail }


