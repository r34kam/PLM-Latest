import { type StagedFile } from '@/components/data-io/FileUpload'
import { ImportPanel } from '@/components/data-io/ImportPanel'
import { MemberPicker } from '@/components/pickers/MemberPicker'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { Stepper } from '@/components/primitives/Stepper'
import { useRoutings } from '@/data/admin'
import { useAllItems } from '@/data/items'
import { useCreateChangeOrder } from '@/data/changeOrders'
import { ITEMS } from '@/domain/catalog'
import { AI_SUGGEST } from '@/domain/ecos'
import { ROUTINGS, ROUTING_NAMES } from '@/domain/routings'
import { ME } from '@/domain/session'
import { ECO_TEMPLATE } from '@/domain/templates'
import { T } from '@/theme/tokens'
import { AlertCircle, Boxes, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Layers, Loader2, Pencil, Plus, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

/* ======================== ECO CREATION FLOW ========================= */


function EcoNew({
  go,
  startStep = 0,
  initialApprovalMode = null,
  initialManualItems = null,
  renderHeaderActions
}: {
  go: any;
  startStep?: number;
  initialApprovalMode?: "ai" | "routing" | "manual" | null;
  initialManualItems?: any[] | null;
  renderHeaderActions?: () => React.ReactNode;
}) {
  const STEPS = ["Basic Details", "Approvals", "Summary"];
  // Map incoming startStep: legacy 4 or 1 -> step 1 (Approvals); legacy 5 or 2 -> step 2 (Summary); 0 -> step 0 (Basic Details)
  const initialStep = startStep === 4 || startStep === 1 ? 1 : startStep === 5 || startStep === 2 ? 2 : 0;
  const initialSubNav = "general";

  const [i, setI] = useState(initialStep);
  const [subSection, setSubSection] = useState<"general" | "desc" | "files" | "confirmations" | "items">(initialSubNav);
  const [imported, setImported] = useState<any[]>([]);
  const [mode, setMode] = useState<"ai" | "routing" | "manual" | null>(initialApprovalMode);
  const [manual, setManual] = useState<any[]>(() => initialManualItems !== null ? initialManualItems : []);
  const [pickOpen, setPickOpen] = useState(false);
  const [picks, setPicks] = useState<any[]>([]);
  const [pickQ, setPickQ] = useState("");
  const { routings: ecoNewRoutings } = useRoutings();
  // Use backend routing names when available, fall back to domain ROUTING_NAMES
  const routingOptions = ecoNewRoutings.length ? ecoNewRoutings.map((r: any) => r.name) : ROUTING_NAMES;
  const [routing, setRouting] = useState(() => ecoNewRoutings.length ? ecoNewRoutings[0].name : ROUTING_NAMES[0]);

  // Sync to first backend routing once loaded (if we started with a domain default)
  React.useEffect(() => {
    if (ecoNewRoutings.length && ROUTING_NAMES.includes(routing)) {
      setRouting(ecoNewRoutings[0].name);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecoNewRoutings.length]);

  // Parse stages for the selected routing from backend data, fall back to domain ROUTINGS
  const selectedBackendRouting = ecoNewRoutings.find((r: any) => r.name === routing);
  const selectedStages: any[] = (() => {
    if (selectedBackendRouting) {
      try { return JSON.parse(selectedBackendRouting.stagesJson || '[]'); } catch { return []; }
    }
    return ROUTINGS[routing] || [];
  })();
  const [manStages, setManStages] = useState([
    { name: "Stage 1", req: "One or more", people: [] },
  ]);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const toggleStageCollapse = (key: string) => {
    setCollapsedStages((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };
  const [picked, setPicked] = useState<string[]>([]);
  const { data: allBackendItems } = useAllItems();
  const [form, setForm] = useState({
    cat: "ECO: Engineering Change Order", title: "",
    div: "CO \u2013 Construction", site: "1210 \u2013 TPS Livermore", eccn: "N/A \u2014 not used", notes: "", dc: "",
    eff: "Effective once approved", effDate: "", effSerial: "", deadline: "",
    desc: "",
  });
  const [confirmations, setConfirmations] = useState({
    validations: "N/A",
    seedStock: "N/A",
    disposition: "Yes",
  });
  const [associatedFiles, setAssociatedFiles] = useState<StagedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createChangeOrder = useCreateChangeOrder();

  const ecoItems = [...imported.map((r: any) => ({ pn: r.pn, name: r.name, sev: r.sev, rule: r.rule, src: "Import" })),
    ...manual.map((m: any) => ({ pn: m.pn, name: m.name, sev: "ok", rule: "Added manually", src: "Manual" }))];

  const isGeneralFilled = Boolean(form.cat && form.div && form.site && form.title);
  const isDescFilled = Boolean(form.desc && form.eff);
  const isFilesFilled = associatedFiles.length > 0;
  // Build pnsJson from the ecoItems for submission
  const isConfirmationsFilled = Boolean(form.eccn && confirmations.validations && confirmations.disposition);
  const isItemsFilled = ecoItems.length > 0;
  const addManual = () => {
    const sourceItems = allBackendItems ?? ITEMS;
    setManual([...manual, ...sourceItems.filter((it: any) => picks.includes(it.pn))]);
    setPicks([]); setPickQ(""); setPickOpen(false);
  };
  const next = () => setI(Math.min(i + 1, 2));
  const back = () => (i === 0 ? go({ page: "ecos" }) : setI(i - 1));

  // Derive the change order type prefix from the cat string (e.g. "ECO: ..." → "ECO")
  const coTypePrefix = form.cat.split(":")[0].trim() as string;
  // Generate a unique ID using the type prefix + timestamp suffix
  const coId = `${coTypePrefix}-${String(Date.now()).slice(-6)}`;
  const today = format(new Date(), "MM/dd/yyyy");

  const handleCreate = async (submitToRouting: boolean) => {
    setIsSubmitting(true);
    try {
      await createChangeOrder({
        coId,
        title: form.title,
        type: coTypePrefix,
        cat: form.cat,
        stage: submitToRouting ? "Submit" : "Open",
        div: form.div.split("–")[0].trim(),
        site: form.site,
        routing,
        creator: ME.name,
        submitter: submitToRouting ? ME.name : "—",
        dc: form.dc || ME.name,
        created: today,
        submitted: submitToRouting ? today : "—",
        itemCount: ecoItems.length,
        modCount: ecoItems.length,
        pnsJson: JSON.stringify(ecoItems.map((it: any) => it.pn)),
        desc: form.desc,
        redline: "",
        notes: [
          form.notes,
          `ECCN: ${form.eccn}`,
          `Effectivity: ${form.eff}${form.eff === "Effective on date" ? ` (${form.effDate})` : form.eff === "Effective on serial number" ? ` (${form.effSerial})` : ""}`,
          `Validations: ${confirmations.validations}`,
          `Seed stock: ${confirmations.seedStock}`,
          `Disposition: ${confirmations.disposition}`,
        ].filter(Boolean).join(" · "),
        priority: "Medium",
        awaitingMe: false,
        effectiveDate: form.eff === "Effective on date" ? form.effDate : "",
        completedDate: "",
      });
      toast.success(`${coId} created${submitToRouting ? " and submitted to routing" : ""}`);
      go({ page: "ecos" });
    } catch {
      toast.error("Failed to create change order — please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="stack" data-test-id="eco-new-page">
      <div className="bet">
        <div><div className="crumb">Changes › New</div><h1>Create change order</h1></div>
        <div className="row">
          <button className="btn gh" onClick={() => go({ page: "ecos" })}><X size={14} strokeWidth={2} />Cancel</button>
          {renderHeaderActions?.()}
        </div>
      </div>
      <Stepper steps={STEPS} i={i} />

      {/* STEP 0: Basic Details with Left Sub-sections & Key-Value Forms */}
      {i === 0 && (
        <div className="eco-wizard-layout" data-test-id="eco-basic-details-layout">
          {/* Left sub-navigation sidebar */}
          <div className="eco-subnav" data-test-id="eco-subnav-pane">
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "general" ? "on" : ""}`}
              onClick={() => setSubSection("general")}
              data-test-id="eco-subnav-general"
            >
              <FileText size={15} />
              <span>Change Details</span>
              {isGeneralFilled ? (
                <span className="sub-check" title="Completed"><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="Incomplete required fields"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "desc" ? "on" : ""}`}
              onClick={() => setSubSection("desc")}
              data-test-id="eco-subnav-desc"
            >
              <FileSpreadsheet size={15} />
              <span>Description & Effectivity</span>
              {isDescFilled ? (
                <span className="sub-check" title="Completed"><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="Incomplete required fields"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "files" ? "on" : ""}`}
              onClick={() => setSubSection("files")}
              data-test-id="eco-subnav-files"
            >
              <Upload size={15} />
              <span>Associated Files</span>
              {isFilesFilled ? (
                <span className="sub-check" title="Completed"><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="No files attached"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "confirmations" ? "on" : ""}`}
              onClick={() => setSubSection("confirmations")}
              data-test-id="eco-subnav-confirmations"
            >
              <ShieldCheck size={15} />
              <span>Confirmations & Processing</span>
              {isConfirmationsFilled ? (
                <span className="sub-check" title="Completed"><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="Incomplete required fields"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "items" ? "on" : ""}`}
              onClick={() => setSubSection("items")}
              data-test-id="eco-subnav-items"
            >
              <Boxes size={15} />
              <span>Add Items</span>
              {ecoItems.length > 0 ? (
                <span className="sub-check" title={`${ecoItems.length} items added`}><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="No items added yet"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>
          </div>

          {/* Right Content Area for Step 0 */}
          <div style={{ minWidth: 0 }}>
            {subSection === "general" && (
              <Card title="Change Details" pad={false}>
                <div className="kv-form" data-test-id="kv-general-details">
                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Change category</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.cat} onChange={(e: any) => setForm({ ...form, cat: e.target.value })}
                        options={["ECO: Engineering Change Order", "DCO: Document Change Order", "TPCO: Third Party Change Order", "RFD: Request for Deviation"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Change number</span>
                    </div>
                    <div className="kv-val">
                      <Input value="Auto — ECO-011421" readOnly style={{ background: T.g50, color: T.g600 }} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Division</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.div} onChange={(e: any) => setForm({ ...form, div: e.target.value })}
                        options={["CO – Construction", "AG – Agriculture"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Site / plant</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.site} onChange={(e: any) => setForm({ ...form, site: e.target.value })}
                        options={["1210 – TPS Livermore", "Fort Collins", "Adelaide", "Sask"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Title</span>
                    </div>
                    <div className="kv-val">
                      <Input value={form.title} placeholder="Enter a descriptive title" onChange={(e: any) => setForm({ ...form, title: e.target.value })} />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {subSection === "desc" && (
              <Card title="Description & Effectivity" pad={false}>
                <div className="kv-form" data-test-id="kv-desc-effectivity">
                  <div className="kv-row" style={{ alignItems: "flex-start" }}>
                    <div className="kv-key" style={{ paddingTop: 6 }}>
                      <span className="kv-label">Redline instructions</span>
                    </div>
                    <div className="kv-val">
                      <textarea className="inp" rows={7} value={form.desc} onChange={(e: any) => setForm({ ...form, desc: e.target.value })}
                        placeholder="Detailed instructions for reviewers and shop floor..." />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Effectivity policy</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.eff} onChange={(e: any) => setForm({ ...form, eff: e.target.value })}
                        options={["Effective once approved", "Effective on date", "Effective on serial number"]} />
                    </div>
                  </div>

                  {form.eff === "Effective on date" && (
                    <div className="kv-row">
                      <div className="kv-key">
                        <span className="kv-label">Effective date</span>
                      </div>
                      <div className="kv-val">
                        <Input type="date" value={form.effDate} onChange={(e: any) => setForm({ ...form, effDate: e.target.value })} data-test-id="eco-eff-date-input" />
                      </div>
                    </div>
                  )}

                  {form.eff === "Effective on serial number" && (
                    <div className="kv-row">
                      <div className="kv-key">
                        <span className="kv-label">Effective serial number</span>
                      </div>
                      <div className="kv-val">
                        <Input value={form.effSerial} placeholder="e.g. SN-00450" onChange={(e: any) => setForm({ ...form, effSerial: e.target.value })} data-test-id="eco-eff-serial-input" />
                      </div>
                    </div>
                  )}

                  {form.eff === "Effective once approved" && (
                    <div className="kv-row">
                      <div className="kv-key">
                        <span className="kv-label">Expiration date</span>
                      </div>
                      <div className="kv-val">
                        <Input value="N/A (this is a permanent change)" readOnly style={{ background: T.g50, color: T.g600 }} />
                      </div>
                    </div>
                  )}

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Approval deadline</span>
                    </div>
                    <div className="kv-val">
                      <Input type="date" value={form.deadline} onChange={(e: any) => setForm({ ...form, deadline: e.target.value })} />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {subSection === "files" && (
              <Card title="Associated Files" sub="Upload CAD drawing redlines, test specifications, and manufacturing work instructions">
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Hidden file input — triggered directly by the drop zone button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.dwg,.step,.stp,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.svg"
                    style={{ display: "none" }}
                    aria-hidden="true"
                    data-test-id="eco-new-file-input"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      const next: StagedFile[] = Array.from(files).map((f) => ({
                        n: f.name,
                        size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                        fileType: "Drawing",
                        visibility: "Internal only",
                      }));
                      setAssociatedFiles((prev) => [...prev, ...next]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="drop"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer.files;
                      if (!files) return;
                      const next: StagedFile[] = Array.from(files).map((f) => ({
                        n: f.name,
                        size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                        fileType: "Drawing",
                        visibility: "Internal only",
                      }));
                      setAssociatedFiles((prev) => [...prev, ...next]);
                    }}
                    data-test-id="eco-new-attach-files-btn"
                    aria-label="Attach files"
                  >
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: "grid", placeItems: "center", margin: "0 auto" }}>
                      <Upload size={20} color={T.brand} />
                    </span>
                    <div style={{ fontWeight: 600, marginTop: 11 }}>Drop files here, or click to choose</div>
                    <div className="sub" style={{ marginTop: 4 }}>PDF, DWG, STEP, Office documents and images · up to 100 MB each</div>
                  </button>
                  {associatedFiles.length > 0 && (
                    <div className="card" style={{ overflow: "hidden" }}>
                      <table className="tbl">
                        <thead><tr><th>File</th><th>Type</th><th>Visibility</th><th></th></tr></thead>
                        <tbody>
                          {associatedFiles.map((f, k) => (
                            <tr key={k} data-test-id={`eco-new-file-row-${k}`}>
                              <td style={{ fontWeight: 600 }}>{f.n}<div className="mini">{f.size}</div></td>
                              <td>{f.fileType}</td>
                              <td>{f.visibility}</td>
                              <td style={{ textAlign: "right" }}>
                                <button className="btn gh sm" type="button" onClick={() => setAssociatedFiles((prev) => prev.filter((_, j) => j !== k))} aria-label={`Remove ${f.n}`}>
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {associatedFiles.length > 0 && (
                    <div className="note" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 size={14} color="#0B7A4B" />
                      <span><b>{associatedFiles.length} file{associatedFiles.length === 1 ? "" : "s"} attached</b></span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {subSection === "confirmations" && (
              <Card title="Confirmations & Processing" pad={false}>
                <div className="kv-form" data-test-id="kv-confirmations">
                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Validations complete?</span>
                    </div>
                    <div className="kv-val">
                      <Select value={confirmations.validations} onChange={(e: any) => setConfirmations({ ...confirmations, validations: e.target.value })}
                        options={["N/A", "Yes", "No"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Seed stock approved?</span>
                    </div>
                    <div className="kv-val">
                      <Select value={confirmations.seedStock} onChange={(e: any) => setConfirmations({ ...confirmations, seedStock: e.target.value })}
                        options={["N/A", "Yes", "No"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">ECCN classification</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.eccn} onChange={(e: any) => setForm({ ...form, eccn: e.target.value })}
                        options={["N/A — not used", "Required — pending review", "Cleared"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Inventory disposition filled?</span>
                    </div>
                    <div className="kv-val">
                      <Select value={confirmations.disposition} onChange={(e: any) => setConfirmations({ ...confirmations, disposition: e.target.value })}
                        options={["Yes", "No"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">DC Representative</span>
                    </div>
                    <div className="kv-val">
                      <Select value={form.dc} onChange={(e: any) => setForm({ ...form, dc: e.target.value })}
                        options={[ME.name, "Adam Royce", "Mamatha Gopal"]} />
                    </div>
                  </div>

                  <div className="kv-row">
                    <div className="kv-key">
                      <span className="kv-label">Status notes</span>
                    </div>
                    <div className="kv-val">
                      <Input value={form.notes} placeholder="CCB 09.09 · DCR7-23172"
                        onChange={(e: any) => setForm({ ...form, notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {subSection === "items" && (
              <div className="stack">
                <Card title="Add items" sub="Upload a spreadsheet, or search and add individually"
                  right={<button className="btn" onClick={() => setPickOpen(true)}><Plus size={13} />Add item manually</button>}>
                  <ImportPanel template={ECO_TEMPLATE} templateName="topcon-eco-items-template.csv"
                    entity="items" onAdd={(rows: any) => setImported(rows)} />
                </Card>

                {manual.length > 0 && (
                  <Card title="Added individually" sub={`${manual.length} item${manual.length > 1 ? "s" : ""} searched and added by hand`} pad={false}
                    right={<button className="btn sm" onClick={() => setPickOpen(true)}><Plus size={12} />Add more</button>}>
                    <table className="tbl">
                      <thead><tr><th>Item number</th><th>Item name</th><th>Rev</th><th>Phase</th><th>New phase</th>
                        <th>New revision</th><th>Disposition</th><th></th></tr></thead>
                      <tbody>
                        {manual.map((m: any) => (
                          <tr key={m.pn}>
                            <td className="pn">{m.pn}</td><td>{m.name}</td><td>{m.rev}</td><td>{phaseChip(m.phase)}</td>
                            <td><Select style={{ height: 26, width: 140 }} options={["In Production", "Discontinued", "Obsolete"]} /></td>
                            <td><Input style={{ height: 26, width: 62 }} defaultValue={String.fromCharCode(m.rev.charCodeAt(0) + 1)} /></td>
                            <td><Select style={{ height: 26, width: 110 }} options={["N/A", "Use up", "Scrap", "Rework"]} /></td>
                            <td style={{ textAlign: "right" }}>
                              <button className="btn gh sm" onClick={() => setManual(manual.filter((x: any) => x.pn !== m.pn))}><Trash2 size={12} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}

                {ecoItems.length > 0 && (
                  <div className="note"><b>{ecoItems.length} items on this change</b>
                    {imported.length > 0 && ` · ${imported.length} imported`}
                    {manual.length > 0 && ` · ${manual.length} added individually`}.</div>
                )}

                {pickOpen && (
                  <Modal title="Add items to ECO-011421" wide onClose={() => { setPickOpen(false); setPicks([]); }}
                    foot={<>
                      <span className="sub">{picks.length} selected</span>
                      <button className="btn" style={{ marginLeft: "auto" }} onClick={() => { setPickOpen(false); setPicks([]); }}>Cancel</button>
                      <button className="btn pri" disabled={!picks.length} onClick={addManual}>
                        <Plus size={13} />Add {picks.length || ""} item{picks.length === 1 ? "" : "s"}</button>
                    </>}>
                    <div style={{ position: "relative", marginBottom: 12 }}>
                      <Search size={13} color={T.g500} style={{ position: "absolute", left: 9, top: 10 }} />
                      <input className="inp" style={{ paddingLeft: 28 }} autoFocus value={pickQ}
                        onChange={(e: any) => setPickQ(e.target.value)}
                        placeholder="Search by part number, name or category" />
                    </div>
                    <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${T.g200}`, borderRadius: 6 }}>
                      <table className="tbl">
                        <thead><tr><th style={{ width: 26 }}></th><th>Item number</th><th>Rev</th><th>Item name</th>
                          <th>Category</th><th>Phase</th></tr></thead>
                        <tbody>
                          {(allBackendItems ?? ITEMS).filter((it: any) => !manual.some((m: any) => m.pn === it.pn) &&
                            (it.pn + it.name + it.cat).toLowerCase().includes(pickQ.toLowerCase())).map((it: any) => {
                            const on = picks.includes(it.pn);
                            const clash = imported.some((r: any) => r.pn === it.pn);
                            return (
                              <tr key={it.pn} className={on ? "sel" : ""} onClick={() =>
                                setPicks(on ? picks.filter((x: any) => x !== it.pn) : [...picks, it.pn])}>
                                <td><input type="checkbox" checked={on} readOnly /></td>
                                <td className="pn">{it.pn}</td><td>{it.rev}</td>
                                <td>{it.name}{clash && <Chip k="warn">Already imported</Chip>}</td>
                                <td className="sub">{it.cat}</td><td>{phaseChip(it.phase)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mini" style={{ marginTop: 10 }}>
                      Searching 110,351 items. Items already locked on another open change are excluded from the results.
                    </div>
                  </Modal>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 1: Approvals */}
      {i === 1 && (
        <div className="stack" data-test-id="eco-new-approvals-step">
          {!mode ? (
            <Card
              title="Select Approval Method"
              sub="Choose how reviewer stages should be determined for this change order"
            >
              <div className="approval-choices-grid" data-test-id="approval-choices-grid">
                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => setMode("routing")}
                  data-test-id="approval-choice-routing"
                >
                  <div className="approval-choice-icon-wrap">
                    <Layers size={20} strokeWidth={1.8} />
                  </div>
                  <div className="approval-choice-title">Predefined routing</div>
                  <div className="approval-choice-desc">
                    Apply standard pre-configured routing templates from Workspace Admin with cross-functional roles.
                  </div>
                  <span className="approval-choice-badge badge-routing">
                    <Layers size={11} strokeWidth={2} />
                    Standard template
                  </span>
                </button>

                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => setMode("ai")}
                  data-test-id="approval-choice-ai"
                >
                  <div className="approval-choice-icon-wrap" style={{ background: "#FAF7FD", color: "#6B46C1" }}>
                    <Sparkles size={20} strokeWidth={1.8} />
                  </div>
                  <div className="approval-choice-title">Assistant suggestion</div>
                  <div className="approval-choice-desc">
                    AI evaluates part category, division, site, and previous changes to recommend required reviewers.
                  </div>
                  <span className="approval-choice-badge badge-ai">
                    <Sparkles size={11} strokeWidth={2} />
                    ✨ AI Powered
                  </span>
                </button>

                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => setMode("manual")}
                  data-test-id="approval-choice-manual"
                >
                  <div className="approval-choice-icon-wrap">
                    <Users size={20} strokeWidth={1.8} />
                  </div>
                  <div className="approval-choice-title">Build manually</div>
                  <div className="approval-choice-desc">
                    Construct custom sequential stages from scratch and assign specific team members for this change.
                  </div>
                  <span className="approval-choice-badge">
                    <Users size={11} strokeWidth={2} />
                    Manual entry
                  </span>
                </button>
              </div>

              <div className="approval-tip-card" data-test-id="approval-selection-tip">
                <div style={{ fontSize: 12, fontWeight: 700, color: T.g800, marginBottom: 4 }}>Tip</div>
                <div style={{ fontSize: 12, color: T.g600, lineHeight: 1.5 }}>
                  Standard routings automatically apply company SOPs and required cross-functional department sign-offs. You can customize stages and add members in any mode.
                </div>
              </div>
            </Card>
          ) : (
            <Card
              title="Approvals"
              sub="Configure reviewer stages and sign-off requirements for this change order"
              right={
                <button
                  type="button"
                  className="btn sm gh"
                  onClick={() => setMode(null)}
                  data-test-id="change-approval-method-btn"
                >
                  <ChevronLeft size={12} />Change method
                </button>
              }
            >
              <div
                className="bet"
                style={{
                  marginBottom: 16,
                  paddingBottom: 12,
                  borderBottom: "1px solid #E2E8F0",
                  flexWrap: "wrap",
                  gap: 10
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn sm gh"
                    onClick={() => setMode(null)}
                    title="Change approval method"
                  >
                    <ChevronLeft size={12} />Change method
                  </button>
                  <span style={{ color: T.g300 }}>|</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.g800 }}>
                    Method: {mode === "routing" ? "Standard Routing" : mode === "ai" ? "Assistant Suggestion" : "Manual Flow"}
                  </span>
                  {mode === "ai" && <Chip k="vio" icon={Sparkles}>AI Powered</Chip>}
                  {mode === "routing" && <Chip k="blue" icon={Layers}>Standard</Chip>}
                  {mode === "manual" && <Chip k="gray" icon={Users}>Manual</Chip>}
                </div>
              </div>

              {mode === "ai" && (
                <div className="stack">
                  <div className="aibox">
                    <div className="row" style={{ marginBottom: 8 }}>
                      <Sparkles size={15} color={T.vio} />
                      <b>Suggested approvers for ECO-011421</b>
                      <Chip k="vio">Suggestion only — you decide</Chip>
                    </div>
                    <div className="sub">
                      Based on SOP-DC-004 (change routing), the division and category of the items on this change, and the approver
                      pattern on the last 14 changes to 1003140-01 and its siblings.
                    </div>
                  </div>
                  <table className="tbl">
                    <thead><tr><th style={{ width: 30 }}></th><th>Approval role</th><th>People</th><th style={{ width: 150 }}>Confidence</th><th>Why</th></tr></thead>
                    <tbody>
                      {AI_SUGGEST.map((a2: any) => {
                        const on = picked.includes(a2.g);
                        return (
                          <tr key={a2.g} className={on ? "sel" : ""}>
                            <td><input type="checkbox" checked={on} onChange={() =>
                              setPicked(on ? picked.filter((x: any) => x !== a2.g) : [...picked, a2.g])} /></td>
                            <td style={{ fontWeight: 600 }}>{a2.g}</td>
                            <td className="sub">{a2.who}</td>
                            <td>
                              <div className="row" style={{ gap: 7 }}>
                                <div style={{ flex: 1, height: 6, background: T.g200, borderRadius: 3, overflow: "hidden" }}>
                                  <div style={{ width: `${a2.conf}%`, height: "100%", background: a2.conf > 80 ? T.ok : a2.conf > 60 ? T.warn : T.g400 }} />
                                </div>
                                <b style={{ fontSize: 11 }}>{a2.conf}%</b>
                              </div>
                            </td>
                            <td className="sub" style={{ maxWidth: 360 }}>{a2.why}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                </div>
              )}

              {mode === "routing" && (
                <div className="stack">
                  <div className="grid2">
                    <Field label="Routing" hint={`${routingOptions.length} routings defined in Admin`}>
                      <Select value={routing} onChange={(e: any) => setRouting(e.target.value)} options={routingOptions} /></Field>
                    <Field label="Matched on" hint="Division and item category of the items on this change">
                      <Input value="Division CO · category KIT" readOnly style={{ background: T.g50, color: T.g600 }} /></Field>
                  </div>
                  {[1, 2].map((st: any) => {
                    const rows = selectedStages.filter((r: any) => r.stage === st);
                    const isCollapsed = Boolean(collapsedStages[`routing-${st}`]);
                    return (
                      <div key={st} className="stagecard" data-test-id={`routing-stagecard-${st}`}>
                        <div
                          className="stagehead"
                          style={{ cursor: "pointer", userSelect: "none" }}
                          data-test-id={`routing-stage-toggle-${st}`}
                          onClick={() => toggleStageCollapse(`routing-${st}`)}
                        >
                          <button
                            type="button"
                            className="btn gh sm"
                            data-test-id={`routing-stage-chevron-${st}`}
                            style={{ width: 24, height: 24, minWidth: 24, padding: 0, display: "grid", placeItems: "center", marginRight: 2 }}
                            title={isCollapsed ? "Expand stage" : "Collapse stage"}
                            aria-label={isCollapsed ? "Expand stage" : "Collapse stage"}
                            onClick={(e: any) => {
                              e.stopPropagation();
                              toggleStageCollapse(`routing-${st}`);
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <span className="stagepill">Stage {st}</span>
                          <b style={{ padding: "3px 6px" }}>{st === 1 ? "Functional approval" : "Document control sign-off"}</b>
                          <span className="mini">{rows.length} role{rows.length === 1 ? "" : "s"}</span>
                          <Chip k="gray" icon={Layers}>From routing</Chip>
                        </div>
                        {!isCollapsed && (
                          <table className="tbl">
                            <thead><tr><th>Approval role</th><th style={{ width: 170 }}>Requirement</th><th>Members</th></tr></thead>
                            <tbody>
                              {rows.map((r: any) => (
                                <tr key={r.g}><td style={{ fontWeight: 600 }}>{r.g}</td>
                                  <td><Chip k={r.req === "One or more" ? "blue" : r.req === "Optional" ? "gray" : "vio"}>{r.req}</Chip></td>
                                  <td className="sub">{r.members.join(", ")}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}

                </div>
              )}

              {mode === "manual" && (
                <div className="stack">
                  <div className="bet">
                    <div><b>Build the approval flow</b>
                      <div className="mini" style={{ marginTop: 2 }}>Stages run in order. Everyone inside a stage is asked at the same time.</div></div>
                    <button className="btn sm" onClick={() => setManStages([...manStages,
                      { name: `Stage ${manStages.length + 1}`, req: "One or more", people: [] }])}>
                      <Plus size={12} />Add stage</button>
                  </div>

                  {!manStages.length && <div className="emptyslot">No stages yet. Add a stage, then add the people who belong to it.</div>}

                  {manStages.map((st: any, k: any) => {
                    const isCollapsed = Boolean(collapsedStages[`manual-${k}`]);
                    return (
                      <div key={k} className="stagecard" data-test-id={`manual-stagecard-${k}`}>
                        <div
                          className="stagehead"
                          style={{ cursor: "pointer", userSelect: "none" }}
                          data-test-id={`manual-stage-toggle-${k}`}
                          onClick={() => toggleStageCollapse(`manual-${k}`)}
                        >
                          <button
                            type="button"
                            className="btn gh sm"
                            data-test-id={`manual-stage-chevron-${k}`}
                            style={{ width: 24, height: 24, minWidth: 24, padding: 0, display: "grid", placeItems: "center", marginRight: 2 }}
                            title={isCollapsed ? "Expand stage" : "Collapse stage"}
                            aria-label={isCollapsed ? "Expand stage" : "Collapse stage"}
                            onClick={(e: any) => {
                              e.stopPropagation();
                              toggleStageCollapse(`manual-${k}`);
                            }}
                          >
                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <span className="stagepill">Stage {k + 1}</span>
                          <input
                            className="stagename"
                            value={st.name}
                            onClick={(e: any) => e.stopPropagation()}
                            onChange={(e: any) => {
                              const n = [...manStages]; n[k] = { ...st, name: e.target.value }; setManStages(n);
                            }}
                          />
                          <span className="mini">{st.people.length} {st.people.length === 1 ? "person" : "people"}</span>
                          <div className="row" style={{ marginLeft: "auto", gap: 7 }} onClick={(e: any) => e.stopPropagation()}>
                            <Select
                              style={{ width: 160, height: 29 }}
                              value={st.req}
                              options={["One or more", "All members", "Optional", "Comments only"]}
                              onChange={(e: any) => { const n = [...manStages]; n[k] = { ...st, req: e.target.value }; setManStages(n); }}
                            />
                            <button
                              type="button"
                              className="btn gh sm"
                              title="Remove stage"
                              onClick={() => setManStages(manStages.filter((_: any, j: any) => j !== k))}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                        {!isCollapsed && (
                          <div style={{ padding: 12 }}>
                            <MemberPicker value={st.people} onChange={(people: any) => {
                              const n = [...manStages]; n[k] = { ...st, people }; setManStages(n); }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* STEP 2: Summary */}
      {i === 2 && (
        <div className="stack" data-test-id="eco-new-summary-step">
          {/* Unified Single Summary Card with Sub-Sections */}
          <div className="eco-summary-unified-card" data-test-id="eco-summary-exec-card">
            {/* Sub-Section 1: Executive Overview */}
            <div className="eco-exec-top">
              <div className="eco-exec-left">
                <div className="row" style={{ gap: 10, alignItems: "center", marginBottom: 6 }}>
                  <span className="pn" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>ECO-011421</span>
                  <Chip k="blue">Open</Chip>
                  <span style={{ fontSize: 12, color: T.g500 }}>·</span>
                  <span style={{ fontSize: 12, color: T.g600, fontWeight: 500 }}>{form.cat.split(":")[0]}</span>
                </div>
                <h2 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 700, color: T.g900, letterSpacing: "-0.01em" }}>
                  {form.title || "Untitled Change Order"}
                </h2>
                <div className="row" style={{ gap: 16, fontSize: 12, color: T.g600 }}>
                  <span><b>Division:</b> {form.div.split("–")[0].trim()}</span>
                  <span>·</span>
                  <span><b>Site:</b> {form.site.split("–")[0].trim()}</span>
                  <span>·</span>
                  <span><b>Effectivity:</b> {form.eff}</span>
                </div>
              </div>

              <div className="eco-exec-metrics">
                {[
                  ["Items", ecoItems.length],
                  ["Stages", mode === "manual" ? manStages.length : 2],
                  ["Approvers", mode === "ai" ? picked.length : mode === "manual"
                    ? manStages.reduce((a2: any, x: any) => a2 + x.people.length, 0) : selectedStages.length]
                ].map(([l, v]: any) => (
                  <div key={l} className="eco-exec-metric-tile">
                    <div style={{ fontSize: 20, fontWeight: 700, color: T.brand, lineHeight: 1 }}>{v}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.g500, marginTop: 4 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-Section 2: Redline Instructions */}
            <div className="eco-exec-instructions">
              <div className="bet" style={{ alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: T.g600 }}>
                  Description & Redline Instructions
                </span>
                <button className="btn sm" onClick={() => { setI(0); setSubSection("desc"); }} data-test-id="summary-edit-desc-btn">
                  <Pencil size={12} />Edit
                </button>
              </div>
              <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.6, color: form.desc ? T.g800 : T.g500, background: "#F8FAFC", padding: "12px 14px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                {form.desc || "No redline instructions provided yet."}
              </div>
            </div>

            {/* Sub-Section 3: Basic Details (Full-width, Stacked) */}
            <div className="eco-summary-sec">
              <div className="eco-summary-sec-head">
                <div>
                  <span className="eco-summary-sec-title">Basic Details</span>
                  <div className="eco-summary-sec-sub">Core identification, ownership, and release schedule</div>
                </div>
                <button className="btn sm" onClick={() => { setI(0); setSubSection("general"); }}><Pencil size={12} />Edit</button>
              </div>
              <div className="eco-summary-kv-grid">
                {[
                  ["Change category", form.cat],
                  ["Change number", "ECO-011421"],
                  ["Title", form.title || "—"],
                  ["Division", form.div],
                  ["Site / plant", form.site],
                  ["Effectivity", form.eff],
                  ["Expiration date", "N/A (permanent change)"],
                  ["Approval deadline", form.deadline || "None specified"]
                ].map(([label, val]: any) => (
                  <div key={label} className="eco-summary-kv-item">
                    <span className="eco-summary-kv-label">{label}</span>
                    <span className="eco-summary-kv-value">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-Section 4: Confirmations & Processing (Full-width, Stacked below Basic Details) */}
            <div className="eco-summary-sec">
              <div className="eco-summary-sec-head">
                <div>
                  <span className="eco-summary-sec-title">Confirmations & Processing</span>
                  <div className="eco-summary-sec-sub">Compliance validations, trade classifications, and document ownership</div>
                </div>
                <button className="btn sm" onClick={() => { setI(0); setSubSection("confirmations"); }}><Pencil size={12} />Edit</button>
              </div>
              <div className="eco-summary-kv-grid">
                {[
                  ["Validations complete?", confirmations.validations],
                  ["Seed stock approved?", confirmations.seedStock],
                  ["ECCN classification", form.eccn],
                  ["Inventory disposition filled?", confirmations.disposition],
                  ["DC representative", form.dc],
                  ["Status notes", form.notes || "—"],
                  ["Change creator", ME.name],
                  ["Associated files", `${associatedFiles.length} file attached`]
                ].map(([label, val]: any) => (
                  <div key={label} className="eco-summary-kv-item">
                    <span className="eco-summary-kv-label">{label}</span>
                    <span className="eco-summary-kv-value">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sub-Section 5: Items on this Change */}
            <div className="eco-summary-sec" style={{ paddingBottom: 0 }}>
              <div className="eco-summary-sec-head">
                <div>
                  <span className="eco-summary-sec-title">Items on this change ({ecoItems.length})</span>
                  <div className="eco-summary-sec-sub">{imported.length} imported, {manual.length} added individually</div>
                </div>
                <button className="btn sm" onClick={() => { setI(0); setSubSection("items"); }}><Pencil size={12} />Edit items</button>
              </div>
              {ecoItems.length === 0 ? (
                <div style={{ padding: "20px 0 24px" }}>
                  <Empty icon={Boxes} title="No items yet" body="Go back to step 1 and add some." />
                </div>
              ) : (
                <div style={{ margin: "0 -28px" }}>
                  <table className="tbl" data-test-id="summary-items-table" style={{ borderLeft: "none", borderRight: "none" }}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item number</th>
                        <th>Item name</th>
                        <th>Source</th>
                        <th>Compliance / Impact</th>
                        <th>Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ecoItems.map((r: any, k: any) => {
                        const isRoHSRisk = r.pn.startsWith("05");
                        const isFileRisk = r.pn.startsWith("04");
                        const isClash = r.sev === "warn";
                        return (
                          <tr key={r.pn + k}>
                            <td>{k + 1}</td>
                            <td><span className="pn">{r.pn}</span></td>
                            <td>{r.name}</td>
                            <td><Chip k={r.src === "Import" ? "blue" : "gray"}>{r.src}</Chip></td>
                            <td>
                              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                {isRoHSRisk ? (
                                  <Chip k="warn">RoHS missing</Chip>
                                ) : (
                                  <Chip k="ok">RoHS compliant</Chip>
                                )}
                                {isFileRisk && <Chip k="warn">No primary file</Chip>}
                                {isClash && <Chip k="bad">ECO-011302 clash</Chip>}
                              </div>
                            </td>
                            <td><Chip k={r.sev === "ok" ? "ok" : "warn"}>{r.rule}</Chip></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Sub-Section 6: Approval Routing */}
            <div className="eco-summary-sec">
              <div className="eco-summary-sec-head">
                <div>
                  <span className="eco-summary-sec-title">Approval Routing</span>
                  <div className="eco-summary-sec-sub">
                    {mode === "ai" ? "Assistant suggestion, editable"
                      : mode === "routing" ? `Routing: ${routing}` : "Built manually"}
                  </div>
                </div>
                <button className="btn sm" onClick={() => setI(1)}><Pencil size={12} />Change</button>
              </div>
              <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "8px 14px", border: "1px solid #E2E8F0" }}>
                {mode === "manual" ? manStages.map((st: any, k: any) => (
                  <div key={k} className="routeline">
                    <span className="stagepill">Stage {k + 1}</span>
                    <div style={{ flex: 1 }}>
                      <b>{st.name}</b>
                      <div className="sub" style={{ marginTop: 2 }}>{st.people.join(", ") || "No one selected"}</div>
                    </div>
                    <Chip k="blue">{st.req}</Chip>
                  </div>
                )) : (
                  <>
                    <div className="routeline">
                      <span className="stagepill">Stage 1</span>
                      <div style={{ flex: 1 }}>
                        <b>Functional approval</b>
                        <div className="sub" style={{ marginTop: 2 }}>
                          {mode === "ai" ? picked.join(" · ")
                            : selectedStages.filter((r: any) => r.stage === 1).map((r: any) => r.g).join(" · ")}
                        </div>
                      </div>
                      <Chip k="blue">One or more each</Chip>
                    </div>
                    <div className="routeline">
                      <span className="stagepill">Stage 2</span>
                      <div style={{ flex: 1 }}>
                        <b>Document control sign-off</b>
                        <div className="sub" style={{ marginTop: 2 }}>Document Control TPS – Livermore · {ME.name}, Adam Royce</div>
                      </div>
                      <Chip k="blue">One or more</Chip>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Bottom action bar — visible on ALL steps ── */}
      <div className="bet" data-test-id="eco-wizard-footer">
        <button className="btn" onClick={back} disabled={isSubmitting} data-test-id="eco-wizard-back-btn">
          <ChevronLeft size={13} />{i === 0 ? "Cancel" : "Back"}
        </button>
        <div className="row">
          {/* Hint text */}
          {i === 0 && (
            <span className="mini" style={{ marginRight: 6 }}>
              {!isGeneralFilled ? "Change Details incomplete — fill required fields"
                : !isDescFilled ? "Description & Effectivity incomplete"
                : ecoItems.length === 0 ? "Add at least 1 item to continue"
                : "Ready to proceed"}
            </span>
          )}
          {i === 1 && !mode && (
            <span className="mini" style={{ marginRight: 6, color: T.g600 }}>
              Select an approval method to proceed
            </span>
          )}
          {i === 2 && (
            <span className="sub" style={{ marginRight: 6 }}>
              Created in Open — stays editable until submitted.
            </span>
          )}

          <button className="btn gh" onClick={() => toast.info("Draft saved")} data-test-id="eco-wizard-save-draft-btn">
            Save draft
          </button>

          {/* Steps 0 and 1: Continue advances the wizard */}
          {i < 2 && (
            <button
              className="btn pri"
              onClick={next}
              disabled={(i === 0 && (!isGeneralFilled || !isDescFilled || ecoItems.length === 0)) || (i === 1 && !mode)}
              data-test-id="eco-wizard-continue-btn"
            >
              Continue <ChevronRight size={13} />
            </button>
          )}

          {/* Step 2: two create actions replace Continue */}
          {i === 2 && (
            <>
              <button
                className="btn"
                onClick={() => handleCreate(false)}
                disabled={isSubmitting}
                data-test-id="eco-create-open-btn"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : null}
                Create — keep open
              </button>
              <button
                className="btn pri"
                onClick={() => handleCreate(true)}
                disabled={isSubmitting}
                data-test-id="eco-create-submit-btn"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Create &amp; submit to routing
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { EcoNew }


