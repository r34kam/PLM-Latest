import { Chip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { useCreateBomItem } from '@/data/bomItems'
import { useAllItems, useCreateItem } from '@/data/items'
import { ITEMS } from '@/domain/catalog'
import { PEOPLE } from '@/domain/people'
import { T } from '@/theme/tokens'
import { useUppy } from '@unifyapps/app-builder-sdk/hooks/upload'
import { Check, ChevronRight, Layers, Plus, Search, Trash2, Upload, X } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'
import { WizardModal } from '@/components/primitives/WizardModal'


function ItemNew({ go, renderHeaderActions, isModal = false, onClose }: {
  go: any;
  renderHeaderActions?: () => React.ReactNode;
  isModal?: boolean;
  onClose?: () => void;
}) {
  const [section, setSection] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  // Identity
  const [itemCat, setItemCat] = useState("KIT");
  const [itemName, setItemName] = useState("");
  const [itemRev, setItemRev] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  // Attributes
  const [itemPhase, setItemPhase] = useState("Design");
  const [itemOwner, setItemOwner] = useState(PEOPLE[0]?.n ?? "");
  const [itemUom, setItemUom] = useState("EA");
  const [itemProc, setItemProc] = useState("Made-to-Specification (MTS)");
  const [itemAssemblyType, setItemAssemblyType] = useState("Component");
  const [primaryFileUrl, setPrimaryFileUrl] = useState<string | undefined>(undefined);

  // Primary file upload
  const { files: primaryFiles, isUploading: primaryUploading, addFiles: addPrimaryFile, removeFile: removePrimaryFile } = useUppy({
    referenceId: "item-new-primary-file",
    accessScope: "PUBLIC",
    maxNumberOfFiles: 1,
    allowedFileTypes: [".pdf", ".dxf", ".dwg", ".xlsx", ".docx", ".zip", "image/*"],
    onUploadSuccess: (file: any) => { if (file.url) setPrimaryFileUrl(file.url); },
  });
  const primaryFile = primaryFiles[0];

  // SAP
  const [itemErp, setItemErp] = useState("SAP");
  const [itemStatus, setItemStatus] = useState("10 – NEW");
  const [itemBomUsage, setItemBomUsage] = useState("Production");
  const [itemPlant, setItemPlant] = useState("1210 – TPS Livermore");
  const [itemMg, setItemMg] = useState("002 – Construction");
  const [itemRohs, setItemRohs] = useState("Yes");

  // BOM items (for KIT/ASSEMBLY) — staged locally, saved after item created
  const isKitCat = ["KIT", "ASSEMBLY"].includes(itemCat);
  const [bomDraft, setBomDraft] = useState<Array<{ pn: string; name: string; cat: string; qty: string; uom: string; refDes: string; notes: string }>>([]);
  const [addBomDraftModal, setAddBomDraftModal] = useState<{
    pn: string; name: string; cat: string; qty: string; uom: string; refDes: string; notes: string;
    pickerQuery: string;
  } | null>(null);
  // All items catalogue for the BOM picker in ItemNew
  const { data: newItemCatalogue } = useAllItems();
  const sections = isKitCat ? ["Identity", "Attributes", "SAP attributes", "BOM items"] : ["Identity", "Attributes", "SAP attributes"];

  const createItem = useCreateItem();
  const createBomItem = useCreateBomItem();

  const isIdentityValid = itemName.trim().length > 0 && itemRev.trim().length > 0;

  const handleCreate = async () => {
    if (!isIdentityValid) { setShowErrors(true); setSection(0); return; }
    setSaving(true);
    try {
      const pn = `10${Date.now().toString().slice(-5)}-01`;
      const result = await createItem({
        pn,
        name: itemName.trim(),
        rev: itemRev.trim(),
        cat: itemCat,
        description: itemDesc,
        phase: itemPhase,
        owner: itemOwner,
        uom: itemUom,
        proc: itemProc,
        assemblyType: itemAssemblyType,
        primaryFile: primaryFileUrl ?? "",
        erpSystem: itemErp,
        status: itemStatus,
        bomUsage: itemBomUsage,
        plant: itemPlant,
        mg: itemMg,
        rohs: itemRohs,
        bom: isKitCat ? bomDraft.length : 0,
        div: itemMg.includes("Agriculture") ? "AG" : "CO",
        created: new Date().toLocaleDateString("en-US"),
        cost: "0.00",
        bomLines: "[]",
      });
      // Save staged BOM items
      if (isKitCat && bomDraft.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        await Promise.all(
          bomDraft.map((b: any) =>
            createBomItem({
              kitNumber: pn,
              pn: b.pn,
              name: b.name,
              cat: b.cat,
              qty: `${b.qty} ${b.uom}`,
              uom: b.uom,
              refDes: b.refDes,
              notes: b.notes,
              addedAt: today,
            })
          )
        );
      }
      toast.success(`${itemCat} "${pn}" created`);
      go({ page: "items" });
    } catch (err) {
      toast.error("Failed to create item — please try again");
    } finally {
      setSaving(false);
    }
  };

  const ITEM_WIZARD_STEPS = sections.map((s: string) => ({ label: s }));

  const itemModalFoot = (
    <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
      <button className="btn" type="button" onClick={() => {
        if (section > 0) setSection(section - 1);
        else (onClose ?? (() => go({ page: "items" })))();
      }} data-test-id="item-wizard-back-btn">
        {section > 0 ? "Back" : "Cancel"}
      </button>
      <div className="row">
        <button className="btn" type="button" onClick={() => (onClose ?? (() => go({ page: "items" })))()}>Save as draft</button>
        {section < sections.length - 1 ? (
          <button className="btn pri" type="button" data-test-id="item-new-next-btn"
            onClick={() => {
              if (section === 0 && !isIdentityValid) { setShowErrors(true); return; }
              setShowErrors(false);
              setSection(section + 1);
            }}>
            Next: {sections[section + 1]}
          </button>
        ) : (
          <button className="btn pri" type="button" disabled={saving} data-test-id="item-new-submit-btn" onClick={handleCreate}>
            {saving ? "Creating…" : "Create item"}
          </button>
        )}
      </div>
    </div>
  );

  const itemContent = (
    <div className="stack" data-test-id="item-new-page">
      {!isModal && (
        <>
          <div>
            <div className="crumb"><a onClick={() => go({ page: "items" })}>Items</a><ChevronRight size={11} strokeWidth={2} />New</div>
            <div className="bet">
              <div>
                <h1>Create item</h1>
                <div className="sub" style={{ marginTop: 4 }}>Define a new part number — it will be created in Design phase until promoted by a change order</div>
              </div>
              <div className="row">{renderHeaderActions?.()}</div>
            </div>
          </div>
          <div className="steps" data-test-id="item-new-stepper" style={{ cursor: "pointer", userSelect: "none" }}>
            {sections.map((s: any, k: any) => (
              <React.Fragment key={s}>
                {k > 0 && <div className="stpline" />}
                <div className={`stp ${k === section ? "on" : k < section ? "dn" : ""}`}
                  onClick={() => setSection(k)} data-test-id={`item-new-step-${k}`} title={`Switch to ${s}`}>
                  <span className="n">{k < section ? <Check size={11} strokeWidth={3} color="#fff" /> : k + 1}</span>
                  <span>{s}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </>
      )}

      {/* Subsection 1: Identity */}
      {section === 0 && (
        <div className="stack">
          <div className="spec-kv-form" data-test-id="item-new-identity-form">
            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Category *</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemCat} onChange={(e: any) => setItemCat(e.target.value)} options={["KIT", "ASSEMBLY", "HARDWARE", "BRACKETS & PLATES", "PCB", "BATTERY", "DOCUMENT"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Item number</span>
            </div>
            <div className="spec-kv-input">
              <Input value="Auto — assigned on save" readOnly style={{ background: "#F0F4F8", color: "#627D98", maxWidth: 380, fontWeight: 600 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Revision *</span>
            </div>
            <div className="spec-kv-input">
              <Input
                value={itemRev}
                onChange={(e: any) => setItemRev(e.target.value)}
                style={{ width: 120, fontWeight: 600, borderColor: showErrors && !itemRev.trim() ? "#B02A20" : undefined }}
              />
              {showErrors && !itemRev.trim() && (
                <div style={{ fontSize: 11, color: "#B02A20", marginTop: 3 }}>Revision is required</div>
              )}
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Item name *</span>
            </div>
            <div className="spec-kv-input">
              <Input
                value={itemName}
                onChange={(e: any) => setItemName(e.target.value)}
                placeholder="e.g. KIT, TS CG MOUNTING"
                style={{ maxWidth: 520, borderColor: showErrors && !itemName.trim() ? "#B02A20" : undefined }}
              />
              {showErrors && !itemName.trim() && (
                <div style={{ fontSize: 11, color: "#B02A20", marginTop: 3 }}>Item name is required</div>
              )}
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Description</span>
            </div>
            <div className="spec-kv-input">
              <textarea className="inp" rows={2} placeholder="Enter description..." style={{ maxWidth: 520 }}
                value={itemDesc} onChange={(e: any) => setItemDesc(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Subsection 2: Attributes */}
      {section === 1 && (
        <div className="stack">
          <div className="spec-kv-form" data-test-id="item-new-attributes-form">
            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Lifecycle phase *</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemPhase} onChange={(e: any) => setItemPhase(e.target.value)} options={["Design", "Prototype", "In Production"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Owner *</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemOwner} onChange={(e: any) => setItemOwner(e.target.value)} options={PEOPLE.map((p: any) => p.n)} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Unit of measure *</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemUom} onChange={(e: any) => setItemUom(e.target.value)} options={["EA", "M", "KG", "L"]} style={{ width: 140 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Procurement type</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemProc} onChange={(e: any) => setItemProc(e.target.value)} options={["Made-to-Specification (MTS)", "Made-to-Print", "Purchased"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Assembly type</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemAssemblyType} onChange={(e: any) => setItemAssemblyType(e.target.value)} options={["Highest accessible assembly", "Subassembly", "Component"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Primary file</span>
            </div>
            <div className="spec-kv-input">
              {primaryFile ? (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 13, color: T.ok, fontWeight: 600 }}>{primaryFile.name}</div>
                  {primaryFile.status === "uploading" && (
                    <div style={{ fontSize: 11, color: T.g500 }}>{primaryFile.progress}%</div>
                  )}
                  {primaryFile.status === "success" && (
                    <Chip k="ok">Uploaded</Chip>
                  )}
                  {primaryFile.status === "error" && (
                    <Chip k="bad">Upload failed</Chip>
                  )}
                  <button
                    type="button"
                    className="btn sm"
                    data-test-id="remove-primary-file-btn"
                    onClick={() => { removePrimaryFile(primaryFile.id); setPrimaryFileUrl(undefined); }}
                  >
                    <X size={12} />Remove
                  </button>
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="primary-file-input"
                    className="btn"
                    style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                    data-test-id="primary-file-label"
                  >
                    <Upload size={13} />
                    {primaryUploading ? "Uploading…" : "Upload primary file"}
                  </label>
                  <input
                    id="primary-file-input"
                    type="file"
                    accept=".pdf,.dxf,.dwg,.xlsx,.docx,.zip,image/*"
                    data-test-id="primary-file-input"
                    style={{ display: "none" }}
                    disabled={primaryUploading}
                    onChange={async (e: any) => {
                      const files = e.target.files;
                      if (!files?.length) return;
                      const [uploaded] = await addPrimaryFile(files);
                      if (uploaded?.status === "success" && uploaded.url) {
                        setPrimaryFileUrl(uploaded.url);
                      } else if (uploaded?.error) {
                        toast.error(uploaded.error);
                      }
                      e.target.value = "";
                    }}
                  />
                  <div className="mini" style={{ marginTop: 4 }}>PDF, DXF, DWG, XLSX, DOCX, ZIP or image — max one file</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subsection 3: SAP attributes */}
      {section === 2 && (
        <div className="stack">
          <div className="spec-kv-form" data-test-id="item-new-sap-form">
            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Import to ERP system?</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemErp} onChange={(e: any) => setItemErp(e.target.value)} options={["SAP", "No"]} style={{ width: 140 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Material status</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemStatus} onChange={(e: any) => setItemStatus(e.target.value)} options={["10 – NEW", "20 – ACTIVE", "50 – INACTIVE"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">BOM usage</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemBomUsage} onChange={(e: any) => setItemBomUsage(e.target.value)} options={["N/A", "Production", "Sales"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Plant</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemPlant} onChange={(e: any) => setItemPlant(e.target.value)} options={["1210 – TPS Livermore", "1220 – Fort Collins", "1310 – Adelaide"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">Material group</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemMg} onChange={(e: any) => setItemMg(e.target.value)} options={["002 – Construction", "004 – Agriculture"]} style={{ maxWidth: 380 }} />
            </div>

            <div className="spec-kv-label">
              <span className="spec-kv-label-text">RoHS compliant</span>
            </div>
            <div className="spec-kv-input">
              <Select value={itemRohs} onChange={(e: any) => setItemRohs(e.target.value)} options={["Yes", "No", "Exempt"]} style={{ width: 140 }} />
            </div>
          </div>
        </div>
      )}

      {/* Section 3: BOM items (KIT/ASSEMBLY only) */}
      {section === 3 && isKitCat && (
        <div className="stack" data-test-id="item-new-bom-form">
          <div className="bet">
            <div>
              <h3>Bill of materials</h3>
              <div className="sub" style={{ marginTop: 3 }}>Add the component parts that go into this {itemCat}. You can also add more after the kit is created.</div>
            </div>
            <button
              type="button"
              className="btn"
              data-test-id="add-bom-draft-btn"
              onClick={() => setAddBomDraftModal({ pn: "", name: "", cat: "HARDWARE", qty: "1", uom: "EA", refDes: "", notes: "", pickerQuery: "" })}
            >
              <Plus size={13} />Add item
            </button>
          </div>

          {bomDraft.length === 0 && !addBomDraftModal ? (
            <Empty
              icon={Layers}
              title="No BOM items yet"
              body="Add component parts to build the bill of materials for this kit."
              action={
                <button className="btn" onClick={() => setAddBomDraftModal({ pn: "", name: "", cat: "HARDWARE", qty: "1", uom: "EA", refDes: "", notes: "", pickerQuery: "" })} data-test-id="empty-bom-add-btn">
                  <Plus size={13} />Add first item
                </button>
              }
            />
          ) : null}

          {bomDraft.length > 0 && (
            <table className="tbl" data-test-id="bom-draft-table">
              <thead><tr><th>#</th><th>Part number</th><th>Name</th><th>Category</th><th>Qty</th><th>Notes</th><th></th></tr></thead>
              <tbody>
                {bomDraft.map((b: any, k: any) => (
                  <tr key={k} data-test-id={`bom-draft-row-${k}`}>
                    <td>{k + 1}</td>
                    <td style={{ fontWeight: 600 }}>{b.pn || "—"}</td>
                    <td>{b.name}</td>
                    <td className="sub">{b.cat}</td>
                    <td>{b.qty} {b.uom}</td>
                    <td className="sub">{b.notes || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="iconbtn"
                        data-test-id={`remove-bom-draft-${k}`}
                        style={{ color: T.bad }}
                        onClick={() => setBomDraft(bomDraft.filter((_: any, i: any) => i !== k))}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Inline Add BOM draft — item picker */}
          {addBomDraftModal && (() => {
            const allCat = (newItemCatalogue ?? []).concat(ITEMS as any[]);
            const seen = new Set<string>();
            // Exclude kit-type categories — BOM components should be leaf-level items
            const KIT_CATS = new Set(['KIT', 'ASSEMBLY', 'PCB']);
            const pickerPool = allCat.filter((i: any) => {
              if (seen.has(i.pn)) return false;
              seen.add(i.pn);
              return !KIT_CATS.has((i.cat ?? '').toUpperCase());
            });
            const dq = addBomDraftModal.pickerQuery.toLowerCase();
            const dFiltered = dq
              ? pickerPool.filter((i: any) => (i.pn + " " + i.name).toLowerCase().includes(dq)).slice(0, 16)
              : pickerPool.slice(0, 10);
            return (
              <div style={{ background: T.b25, border: `1px solid ${T.g200}`, borderRadius: 10, padding: 16 }} data-test-id="add-bom-draft-panel">
                <h3 style={{ marginBottom: 10 }}>Add component</h3>
                {/* Search */}
                <div style={{ position: "relative", marginBottom: 8 }}>
                  <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.g500, pointerEvents: "none" }} />
                  <Input
                    value={addBomDraftModal.pickerQuery}
                    autoFocus
                    placeholder="Search catalogue by part number or name…"
                    data-test-id="bom-draft-search-input"
                    style={{ paddingLeft: 30 }}
                    onChange={(e: any) => setAddBomDraftModal({ ...addBomDraftModal, pickerQuery: e.target.value, pn: "", name: "", cat: "HARDWARE" })}
                  />
                </div>
                {/* Selected */}
                {addBomDraftModal.pn && (
                  <div style={{ background: "#fff", border: `1px solid ${T.b200}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{addBomDraftModal.pn}</div>
                      <div className="sub">{addBomDraftModal.name} · {addBomDraftModal.cat}</div>
                    </div>
                    <button type="button" className="iconbtn" onClick={() => setAddBomDraftModal({ ...addBomDraftModal, pn: "", name: "", cat: "HARDWARE", pickerQuery: "" })}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                {/* Picker list when no selection yet */}
                {!addBomDraftModal.pn && (
                  <div style={{ border: `1px solid ${T.g200}`, borderRadius: 8, overflow: "hidden", maxHeight: 200, overflowY: "auto", marginBottom: 8, background: "#fff" }}>
                    {dFiltered.length === 0
                      ? <div style={{ padding: "10px 12px", color: T.g500, fontSize: 13 }}>No match for "{addBomDraftModal.pickerQuery}"</div>
                      : dFiltered.map((item: any) => (
                          <button
                            key={item.pn}
                            type="button"
                            data-test-id={`bom-draft-pick-${item.pn}`}
                            style={{ display: "flex", width: "100%", padding: "8px 12px", gap: 10, textAlign: "left", background: "transparent", borderBottom: `1px solid ${T.g100}`, cursor: "pointer" }}
                            onClick={() => setAddBomDraftModal({ ...addBomDraftModal, pn: item.pn, name: item.name, cat: item.cat, pickerQuery: "" })}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{item.pn}</div>
                              <div style={{ fontSize: 12, color: T.g600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                            </div>
                            <Chip k="gray">{item.cat}</Chip>
                          </button>
                        ))
                    }
                  </div>
                )}
                {/* Qty + notes after selection */}
                {addBomDraftModal.pn && (
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <Field label="Qty" hint="">
                      <div className="row" style={{ gap: 6 }}>
                        <Input value={addBomDraftModal.qty} style={{ width: 70 }} data-test-id="bom-draft-qty-input" onChange={(e: any) => setAddBomDraftModal({ ...addBomDraftModal, qty: e.target.value })} />
                        <Select value={addBomDraftModal.uom} options={["EA", "M", "KG", "L"]} style={{ width: 70 }} data-test-id="bom-draft-uom-select" onChange={(e: any) => setAddBomDraftModal({ ...addBomDraftModal, uom: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Notes" hint="">
                      <Input value={addBomDraftModal.notes} placeholder="Assembly note" data-test-id="bom-draft-notes-input" onChange={(e: any) => setAddBomDraftModal({ ...addBomDraftModal, notes: e.target.value })} />
                    </Field>
                  </div>
                )}
                <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setAddBomDraftModal(null)}>Cancel</button>
                  <button
                    type="button"
                    className="btn pri"
                    data-test-id="confirm-bom-draft-btn"
                    disabled={!addBomDraftModal.pn.trim()}
                    onClick={() => {
                      setBomDraft([...bomDraft, { pn: addBomDraftModal.pn, name: addBomDraftModal.name, cat: addBomDraftModal.cat, qty: addBomDraftModal.qty, uom: addBomDraftModal.uom, refDes: "", notes: addBomDraftModal.notes }]);
                      setAddBomDraftModal(null);
                    }}
                  >
                    <Check size={13} />Add to list
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {!isModal && (
        <div className="bet" style={{ paddingTop: 4 }}>
          <button className="btn" type="button" onClick={() => {
            if (section > 0) setSection(section - 1);
            else go({ page: "items" });
          }}>
            {section > 0 ? "Previous step" : "Cancel"}
          </button>
          <div className="row">
            <button className="btn" type="button" onClick={() => go({ page: "items" })}>Save as draft</button>
            {section < sections.length - 1 ? (
              <button className="btn pri" type="button" data-test-id="item-new-next-btn"
                onClick={() => {
                  if (section === 0 && !isIdentityValid) { setShowErrors(true); return; }
                  setShowErrors(false);
                  setSection(section + 1);
                }}>
                {`Next: ${sections[section + 1]}`}
              </button>
            ) : (
              <button className="btn pri" type="button" disabled={saving} data-test-id="item-new-submit-btn" onClick={handleCreate}>
                {saving ? "Creating…" : "Create item"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <WizardModal
        title="Create item"
        steps={ITEM_WIZARD_STEPS}
        currentStep={section}
        onStepClick={(idx) => { if (idx < section) setSection(idx); }}
        onClose={onClose ?? (() => go({ page: "items" }))}
        foot={itemModalFoot}
        data-test-id="item-new-modal"
      >
        {itemContent}
      </WizardModal>
    );
  }

  return itemContent;
}

export { ItemNew }


