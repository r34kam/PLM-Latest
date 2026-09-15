import { type StagedFile } from '@/components/data-io/FileUpload'
import { ImportPanel } from '@/components/data-io/ImportPanel'
import { MemberPicker } from '@/components/pickers/MemberPicker'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { WizardModal } from '@/components/primitives/WizardModal'
import { Stepper } from '@/components/primitives/Stepper'
import { useRoutings } from '@/data/admin'
import { useAllItems } from '@/data/items'
import { useKitExtractor } from '@/data/kitExtractor'
import { useCreateChangeOrder, type ApprovalEntry, type CoHistoryEntry } from '@/data/changeOrders'
import { ITEMS, ASSEMBLIES } from '@/domain/catalog'
import { bomFor } from '@/domain/boms'
import { useEcoApprovalFlow, type AiSuggestion } from '@/data/ecoApprovalFlow'
import { ROUTINGS, ROUTING_NAMES, approvalsFor } from '@/domain/routings'
import { ME } from '@/domain/session'
import { ECO_TEMPLATE } from '@/domain/templates'
import { T } from '@/theme/tokens'
import { AlertCircle, Boxes, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Info, Layers, Loader2, Pencil, Plus, Search, Send, ShieldCheck, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

/* ---- BOM edit types ---- */
type BomEditType = 'ADD' | 'DELETE' | 'UPDATE_DESC' | 'UPDATE_QTY';
type BomEdit = {
  id: string;
  type: BomEditType;
  pn: string;
  name: string;
  qty: string;
  newValue: string; // new description or new qty string

};
type KitItem = {
  pn: string;
  name: string;
  rev: string;
  cat: string;
  phase: string;
  currentRev: string;
  newRev: string;
  bomEdits: BomEdit[];
  bomFile: StagedFile | null;
  editMode: 'inline' | 'file';
};

/* ======================== BOM EXCEL PARSER ========================== */

/**
 * Accepted column headers (case-insensitive, trimmed):
 *   Change Type | Part Number | Part Name | Qty | Notes / New Value
 *
 * Valid Change Type values → mapped to BomEditType:
 *   ADD / REMOVE / DELETE → DELETE maps to DELETE, ADD → ADD
 *   UPDATE_QTY / UPDATE QTY / MODIFY QTY → UPDATE_QTY
 *   UPDATE_DESC / UPDATE DESC / MODIFY DESC → UPDATE_DESC
 */
function parseBomExcel(
  buf: ArrayBuffer,
  catalogPns: Set<string>
): { edits: BomEdit[]; parseError?: string } {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buf, { type: 'array' })
  } catch {
    return { edits: [], parseError: 'Could not read file — please upload a valid Excel or CSV file.' }
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  if (rows.length === 0) return { edits: [], parseError: 'The file appears to be empty.' }

  // Normalise headers: find canonical column by fuzzy match
  function col(row: Record<string, string>, ...candidates: string[]): string {
    for (const key of Object.keys(row)) {
      const k = key.trim().toLowerCase().replace(/[\s_]+/g, '')
      for (const c of candidates) {
        if (k === c.toLowerCase().replace(/[\s_]+/g, '')) return String(row[key] ?? '').trim()
      }
    }
    return ''
  }

  function mapType(raw: string): BomEditType {
    const t = raw.trim().toLowerCase().replace(/[\s_]+/g, '')
    if (t === 'delete' || t === 'remove') return 'DELETE'
    if (t === 'updatedesc' || t === 'modifydesc' || t === 'changedesc') return 'UPDATE_DESC'
    if (t === 'updateqty' || t === 'modifyqty' || t === 'changeqty') return 'UPDATE_QTY'
    return 'ADD'
  }

  const edits: BomEdit[] = []
  rows.forEach((row, idx) => {
    const pn = col(row, 'Part Number', 'PartNumber', 'Item Number', 'PN', 'Part No')
    if (!pn) return // skip blank rows
    const type = mapType(col(row, 'Change Type', 'ChangeType', 'Type', 'Action', 'Edit Type'))
    const name = col(row, 'Part Name', 'PartName', 'Item Name', 'Description', 'Name')
    const qty = col(row, 'Qty', 'Quantity', 'QTY')
    const newValue = col(row, 'Notes', 'New Value', 'NewValue', 'Value', 'Note')
    edits.push({ id: `file-${idx}-${Date.now()}`, type, pn, name, qty, newValue })
  })

  if (edits.length === 0) return { edits: [], parseError: 'No valid rows found. Check the column headers match the expected format.' }
  return { edits }
}

/* ======================== ECO CREATION FLOW ========================= */


function EcoNew({
  go,
  startStep = 0,
  initialApprovalMode = null,
  initialManualItems = null,
  renderHeaderActions,
  isModal = false,
  onClose,
}: {
  go: any;
  startStep?: number;
  initialApprovalMode?: "ai" | "routing" | "manual" | null;
  initialManualItems?: any[] | null;
  renderHeaderActions?: () => React.ReactNode;
  isModal?: boolean;
  onClose?: () => void;
}) {
  const STEPS = ["Basic Details", "Add Items", "Approvals", "Summary"];
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

  // Kit-first BOM redline state
  const [itemMode, setItemMode] = useState<'manual' | 'instructions' | null>(null);
  const [instructionsParsing, setInstructionsParsing] = useState(false);

  const [kits, setKits] = useState<KitItem[]>([]);
  const [kitPickOpen, setKitPickOpen] = useState(false);
  const [kitPickQ, setKitPickQ] = useState("");
  const [expandedKits, setExpandedKits] = useState<Record<string, boolean>>({});
  const [editingBomEdit, setEditingBomEdit] = useState<{ kitPn: string; editId: string | null } | null>(null);
  const [bomEditDraft, setBomEditDraft] = useState<Partial<BomEdit>>({});
  const [kitChildPickOpen, setKitChildPickOpen] = useState<string | null>(null); // kitPn of open picker
  const [kitChildQ, setKitChildQ] = useState("");
  const kitFileInputRef = useRef<HTMLInputElement>(null);
  const [activeKitFilePn, setActiveKitFilePn] = useState<string | null>(null);
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

  // AI Approval Flow automation state
  const { run: runFlow, isPending: aiLoading, error: aiError, reset: aiReset } = useEcoApprovalFlow()
  const [aiState, setAiState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])

  async function runAiSuggest() {
    setAiState('loading')
    aiReset()
    try {
      const result = await runFlow({
        coId: coId ?? '',
        type: coTypePrefix,
        cat: form.cat,
        routing,
        div: form.div.split('–')[0].trim(),
        site: form.site,
        title: form.title,
        desc: form.desc,
        redline: '',
        pnsJson: JSON.stringify(ecoItems.map((it: any) => it.pn)),
        itemCount: ecoItems.length,
        modCount: ecoItems.length,
        priority: 'Medium',
        creator: ME.name,
        submitter: ME.name,
      })
      setAiSuggestions(result)
      // Pre-check all roles the AI recommends (those without drop:true)
      setPicked(result.filter((r) => !r.drop).map((r) => r.g))
      setAiState('done')
    } catch {
      setAiState('error')
    }
  }
  const { data: allBackendItems } = useAllItems();
  const { extract: extractFromInstructions } = useKitExtractor();
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

  // Legacy items (import / manual individual adds) kept for backward-compat
  const legacyItems = [...imported.map((r: any) => ({ pn: r.pn, name: r.name, sev: r.sev, rule: r.rule, src: "Import" })),
    ...manual.map((m: any) => ({ pn: m.pn, name: m.name, sev: "ok", rule: "Added manually", src: "Manual" }))];
  // Kit-based items — one row per kit
  const kitItems = kits.map((k) => ({
    pn: k.pn, name: k.name, sev: "ok",
    rule: k.editMode === "file" && k.bomFile ? `File: ${k.bomFile.n}` : `${k.bomEdits.length} BOM edit${k.bomEdits.length !== 1 ? "s" : ""}`,
    src: "Kit",
    bomEdits: k.bomEdits,
    bomFile: k.bomFile,
    editMode: k.editMode,
    currentRev: k.currentRev,
    newRev: k.newRev,
  }));
  const ecoItems = [...kitItems, ...legacyItems];

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

  /* ---- Kit helpers ---- */
  const addKit = (it: any) => {
    if (kits.some((k) => k.pn === it.pn)) return;
    const nextRevCode = it.rev.length === 1 && it.rev >= "A" && it.rev < "Z"
      ? String.fromCharCode(it.rev.charCodeAt(0) + 1)
      : `${it.rev}+1`;
    setKits((prev) => [...prev, {
      pn: it.pn, name: it.name, rev: it.rev, cat: it.cat || "KIT", phase: it.phase || "In Production",
      currentRev: it.rev, newRev: nextRevCode,
      bomEdits: [], bomFile: null, editMode: "inline",
    }]);
    setExpandedKits((prev) => ({ ...prev, [it.pn]: true }));
    setKitPickQ(""); // picker stays open — user clicks "Done adding" to close
  };
  // Use the Kit BOM Change Extractor automation to parse redline instructions
  const pickFromInstructions = async () => {
    const text = form.desc ?? '';
    if (!text.trim()) return;
    setItemMode('instructions');
    setInstructionsParsing(true);
    try {
      const result = await extractFromInstructions(text);
      const catalog: any[] = allBackendItems ?? [...ITEMS, ...ASSEMBLIES];

      // Find the kit in the catalogue by kitNumber
      const kitRecord = catalog.find(
        (it: any) => (it.pn ?? '').toUpperCase() === (result.kitNumber ?? '').toUpperCase()
      ) ?? {
        pn: result.kitNumber,
        name: result.kitNumber,
        rev: 'A',
        cat: 'KIT',
        phase: 'In Production',
      };

      if (result.kitNumber) {
        addKit(kitRecord);

        // Add each extracted item as a BOM edit on the kit
        result.items.forEach((item) => {
          const rawType = (item.type ?? 'add').toLowerCase();
          const editType: BomEditType =
            rawType === 'remove' || rawType === 'delete' ? 'DELETE'
            : rawType === 'modify' || rawType === 'update' || rawType === 'update_qty' ? 'UPDATE_QTY'
            : rawType === 'update_desc' ? 'UPDATE_DESC'
            : 'ADD';
          const pn = item.pn ?? '';
          const bomEdit: BomEdit = {
            id: `${result.kitNumber}-${Date.now()}-${Math.random()}`,
            type: editType,
            pn,
            name: item.name ?? '',
            qty: item.qty ?? '',
            newValue: item.newValue ?? '',
          };
          addBomEdit(kitRecord.pn, bomEdit);
        });
      } else {
        toast.warning('No kit number could be extracted from the instructions. Add the kit manually and paste the BOM edits.');
      }
    } catch {
      toast.error('Failed to extract from instructions — check your redline text and try again.');
    } finally {
      setInstructionsParsing(false);
      setItemMode('manual');
    }
  };

  const removeKit = (pn: string) => setKits((prev) => prev.filter((k) => k.pn !== pn));
  const updateKit = (pn: string, patch: Partial<KitItem>) =>
    setKits((prev) => prev.map((k) => k.pn === pn ? { ...k, ...patch } : k));
  const addBomEdit = (kitPn: string, edit: BomEdit) =>
    setKits((prev) => prev.map((k) => k.pn === kitPn ? { ...k, bomEdits: [...k.bomEdits, edit] } : k));
  const removeBomEdit = (kitPn: string, editId: string) =>
    setKits((prev) => prev.map((k) => k.pn === kitPn ? { ...k, bomEdits: k.bomEdits.filter((e) => e.id !== editId) } : k));
  const openBomEditDraft = (kitPn: string, type: BomEditType = "ADD") => {
    setBomEditDraft({ type, pn: "", name: "", qty: "", newValue: "" });
    setEditingBomEdit({ kitPn, editId: null });
  };
  const commitBomEdit = () => {
    if (!editingBomEdit) return;
    const { kitPn } = editingBomEdit;
    if (!bomEditDraft.pn) return;
    const edit: BomEdit = {
      id: `${kitPn}-${Date.now()}`,
      type: bomEditDraft.type as BomEditType || "ADD",
      pn: bomEditDraft.pn || "",
      name: bomEditDraft.name || "",
      qty: bomEditDraft.qty || "",
      newValue: bomEditDraft.newValue || "",
    };
    addBomEdit(kitPn, edit);
    setEditingBomEdit(null);
    setBomEditDraft({});
  };
  const addBomEditFromChild = (kitPn: string, child: any, editType: BomEditType) => {
    const edit: BomEdit = {
      id: `${kitPn}-${Date.now()}`,
      type: editType,
      pn: child.pn, name: child.name,
      qty: child.qty || "1 EA",
      newValue: "",
    };
    addBomEdit(kitPn, edit);
  };
  const BOM_EDIT_LABELS: Record<BomEditType, string> = {
    ADD: "Add", DELETE: "Delete", UPDATE_DESC: "Update description", UPDATE_QTY: "Update qty",
  };
  const next = () => setI(Math.min(i + 1, 3));
  const back = () => (i === 0 ? go({ page: "ecos" }) : setI(i - 1));

  // Derive the change order type prefix from the cat string (e.g. "ECO: ..." → "ECO")
  const coTypePrefix = form.cat.split(":")[0].trim() as string;
  // Generate a unique ID using the type prefix + timestamp suffix
  const coId = `${coTypePrefix}-${String(Date.now()).slice(-6)}`;
  const today = format(new Date(), "MM/dd/yyyy");

  const handleCreate = async () => {
    setIsSubmitting(true);

    // Build initial pending approvals from the correct source for the chosen mode:
    //   ai      → AI suggestions filtered to the roles the user kept (picked)
    //   manual  → the manually-configured stages (manStages)
    //   routing → the backend/domain routing stages (selectedStages)
    let initialApprovals: ApprovalEntry[];

    if (mode === 'ai') {
      initialApprovals = aiSuggestions
        .filter((s) => picked.includes(s.g))
        .map((s) => {
          const members = s.who.split(',').map((n) => n.trim()).filter(Boolean);
          return {
            role: s.g,
            approver: members[0] ?? 'Unassigned',
            req: s.req,
            stage: s.stage ?? 1,
            status: 'pending' as const,
            signedAt: '',
            comment: '',
            others: members.slice(1),
          };
        });
    } else if (mode === 'manual') {
      initialApprovals = manStages.flatMap((st: any, idx: number) =>
        (st.people ?? []).map((person: string) => ({
          role: st.name || `Stage ${idx + 1}`,
          approver: person,
          req: st.req || 'One or more',
          stage: idx + 1,
          status: 'pending' as const,
          signedAt: '',
          comment: '',
          others: [],
        }))
      );
    } else {
      // routing mode — use the selected backend or domain routing stages
      initialApprovals = selectedStages.map((r: any) => ({
        role: r.g,
        approver: r.members?.[0] ?? r.n ?? 'Unassigned',
        req: r.req,
        stage: r.stage ?? 1,
        status: 'pending' as const,
        signedAt: '',
        comment: '',
        others: (r.members ?? []).slice(1),
      }));
    }
    try {
      await createChangeOrder({
        coId,
        title: form.title,
        type: coTypePrefix,
        cat: form.cat,
        stage: "Approval",
        div: form.div.split("–")[0].trim(),
        site: form.site,
        routing,
        creator: ME.name,
        submitter: ME.name,
        dc: form.dc || ME.name,
        created: today,
        submitted: today,
        itemCount: ecoItems.length,
        modCount: ecoItems.length,
        pnsJson: JSON.stringify(ecoItems.map((it: any) => it.pn)),
        ecoItems: kits.map((k) => ({
          pn: k.pn, name: k.name, rev: k.rev, cat: k.cat,
          currentRev: k.currentRev, newRev: k.newRev, bomEdits: k.bomEdits,
        })),
        comments: [],
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
        approvals: initialApprovals,
        currentStageNum: 1,
        rejectionReason: '',
        rejectionNotes: '',
        rejectedBy: '',
        // Seed notifications with every person in the approval flow so the
        // Notifications tab is fully populated from day one.
        extraNotifyNames: (() => {
          const seen = new Set<string>()
          const names: string[] = []
          const add = (n: string) => { if (n && n !== 'Unassigned' && !seen.has(n)) { seen.add(n); names.push(n) } }
          add(ME.name)                                  // submitter is always first
          for (const r of initialApprovals) {
            add(r.approver)
            for (const o of r.others ?? []) add(o)
          }
          return names
        })(),
        history: [{
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          who: ME.name,
          action: `Change order created by ${ME.name} and submitted to approval — ${initialApprovals.length} approver role${initialApprovals.length !== 1 ? 's' : ''} notified`,
        }] as CoHistoryEntry[],
      });
      toast.success(`${coId} submitted to ${routing} approval flow`);
      go({ page: "ecos" });
    } catch {
      toast.error("Failed to create change order — please try again");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ECO STEPS metadata for the wizard sidebar
  const ECO_WIZARD_STEPS = [
    { label: "Basic Details", sub: "Title, type & priority" },
    { label: "Add Items", sub: "Kits & assemblies to change" },
    { label: "Approvals", sub: "Routing & approval method" },
    { label: "Summary", sub: "Review & submit" },
  ];

  const modalFoot = (
    <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
      <button className="btn" onClick={i === 0 ? onClose ?? (() => go({ page: "ecos" })) : back} disabled={isSubmitting} data-test-id="eco-wizard-back-btn">
        {i === 0 ? "Cancel" : "Back"}
      </button>
      <div className="row">
        {i === 0 && (
          <span className="mini" style={{ marginRight: 6 }}>
            {!isGeneralFilled ? "Change Details incomplete — fill required fields"
              : "Ready to proceed"}
          </span>
        )}
        {i === 1 && (
          <span className="mini" style={{ marginRight: 6 }}>
            {ecoItems.length === 0 ? "Add at least 1 item to continue" : `${ecoItems.length} item${ecoItems.length === 1 ? "" : "s"} added`}
          </span>
        )}
        {i === 2 && !mode && (
          <span className="mini" style={{ marginRight: 6 }}>Select an approval method to proceed</span>
        )}
        {i === 3 && (
          <span className="sub" style={{ marginRight: 6 }}>Created in Open — stays editable until submitted.</span>
        )}
        <button className="btn gh" onClick={() => toast.info("Draft saved")} data-test-id="eco-wizard-save-draft-btn">Save draft</button>
        {i < 3 && (
          <button className="btn pri" onClick={next}
            disabled={(i === 0 && !isGeneralFilled) || (i === 1 && ecoItems.length === 0) || (i === 2 && !mode)}
            data-test-id="eco-wizard-continue-btn">
            Continue
          </button>
        )}
        {i === 3 && (
          <button className="btn pri" onClick={handleCreate} disabled={isSubmitting} data-test-id="eco-create-submit-btn">
            {isSubmitting ? "Creating…" : "Create & submit to routing"}
          </button>
        )}
      </div>
    </div>
  );

  
  const content = (
    <div className="stack" data-test-id="eco-new-page">
      {!isModal && (
        <>
          <div className="bet">
            <div>
              <div className="crumb"><button type="button" className="crumb-link" onClick={() => go({ page: "home" })} data-test-id="eco-new-breadcrumb-home">Changes</button> › New</div>
              <h1>Create change order</h1>
              <div className="sub" style={{ marginTop: 4 }}>Start a new change request — fill in the details, add affected items, and route for approval</div>
            </div>
            <div className="row">
              <button className="btn gh" onClick={() => go({ page: "ecos" })}><X size={14} strokeWidth={2} />Cancel</button>
              {renderHeaderActions?.()}
            </div>
          </div>
          <Stepper steps={STEPS} i={i} />
        </>
      )}

      {/* STEP 0: Basic Details with Left Sub-sections & Key-Value Forms */}
      {i === 0 && (
        <div className="eco-wizard-layout" data-test-id="eco-basic-details-layout">
          {/* Left sub-navigation tabs — only visible on Basic Details step */}
          {i === 0 && (
          <div className="eco-subnav" data-test-id="eco-subnav-pane">
            <button
              type="button"
              className={`eco-subnav-btn ${subSection === "general" ? "on" : ""}`}
              onClick={() => setSubSection("general")}
              data-test-id="eco-subnav-general"
            >
              <span>Change Details</span>
              {isGeneralFilled ? (
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
              <span>Confirmations & Processing</span>
              {isConfirmationsFilled ? (
                <span className="sub-check" title="Completed"><Check size={11} strokeWidth={2.8} /></span>
              ) : (
                <span className="sub-pending" title="Incomplete required fields"><AlertCircle size={11} strokeWidth={2.4} /></span>
              )}
            </button>

          </div>
          )}

          {/* Right Content Area for Step 0 */}
          <div style={{ minWidth: 0 }}>
            {subSection === "general" && (
              <div className="eco-flat-form" data-test-id="kv-general-details">
                <div className="eco-flat-field">
                  <label className="eco-flat-label" htmlFor="eco-cat">Change category</label>
                  <Select id="eco-cat" value={form.cat} onChange={(e: any) => setForm({ ...form, cat: e.target.value })}
                    options={["ECO: Engineering Change Order", "DCO: Document Change Order", "TPCO: Third Party Change Order", "RFD: Request for Deviation"]} />
                </div>
                <div className="eco-flat-field">
                  <label className="eco-flat-label" htmlFor="eco-num">Change number</label>
                  <Input id="eco-num" value="Auto — ECO-011421" readOnly style={{ background: T.g50, color: T.g600 }} />
                </div>
                <div className="eco-flat-field">
                  <label className="eco-flat-label" htmlFor="eco-div">Division</label>
                  <Select id="eco-div" value={form.div} onChange={(e: any) => setForm({ ...form, div: e.target.value })}
                    options={["CO – Construction", "AG – Agriculture"]} />
                </div>
                <div className="eco-flat-field">
                  <label className="eco-flat-label" htmlFor="eco-site">Site / plant</label>
                  <Select id="eco-site" value={form.site} onChange={(e: any) => setForm({ ...form, site: e.target.value })}
                    options={["1210 – TPS Livermore", "Fort Collins", "Adelaide", "Sask"]} />
                </div>
                <div className="eco-flat-field">
                  <label className="eco-flat-label" htmlFor="eco-title">Title <span style={{ color: '#e53e3e' }}>*</span></label>
                  <Input id="eco-title" value={form.title} placeholder="Enter a descriptive title" onChange={(e: any) => setForm({ ...form, title: e.target.value })} data-test-id="eco-title-input" />
                </div>
                <div className="eco-flat-field" data-test-id="kv-row-redline-instructions">
                  <label className="eco-flat-label" htmlFor="eco-redline" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    Redline instructions
                    <span className="eco-info-tip" data-test-id="redline-instructions-tooltip-icon">
                      <Info size={13} />
                      <span className="eco-info-tip-bubble" role="tooltip">
                        This description will be used to create Item list automatically
                      </span>
                    </span>
                  </label>
                  <textarea
                    id="eco-redline"
                    className="inp"
                    rows={6}
                    value={form.desc}
                    onChange={(e: any) => setForm({ ...form, desc: e.target.value })}
                    placeholder="Detailed instructions for reviewers and shop floor..."
                    data-test-id="redline-instructions-textarea"
                  />
                </div>
              </div>
            )}

            {subSection === "desc" && (
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
            )}

            {subSection === "files" && (
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
            )}

            {subSection === "confirmations" && (
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
                        options={[ME.name, "Adam Royce", "Nadia Haddad"]} />
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
            )}

          </div>
        </div>
      )}

      {/* STEP 1: Add Items */}
      {i === 1 && (
        <div className="stack" style={{ flex: 1, minHeight: 0 }} data-test-id="eco-new-items-step">

          {/* ── Item mode selection (shown when no mode chosen yet) ── */}
          {!itemMode && (
            <div className="choice-centered-wrap" data-test-id="item-method-selection">
              <div style={{ fontWeight: 700, fontSize: 16, color: '#0a2233', marginBottom: 6, textAlign: 'center' }}>How would you like to add items?</div>
              <div className="sub" style={{ fontSize: 13, marginBottom: 24, textAlign: 'center' }}>Choose how to populate the affected kits and assemblies for this change order</div>
              <div className="item-choice-grid" data-test-id="item-choices-grid">
                <button
                  type="button"
                  className="approval-choice-card item-choice-card"
                  onClick={() => setItemMode('manual')}
                  data-test-id="item-choice-manual"
                >
                  <span className="approval-choice-radio" aria-hidden="true"><span className="approval-choice-radio-dot" /></span>
                  <div className="approval-choice-title">Add manually</div>
                  <div className="approval-choice-desc">
                    Search and select kits or assemblies from the catalog and specify BOM edits inline or via redline file.
                  </div>
                </button>

                <button
                  type="button"
                  className="approval-choice-card item-choice-card"
                  onClick={pickFromInstructions}
                  disabled={!form.desc}
                  data-test-id="item-choice-instructions"
                >
                  <span className="approval-choice-radio" aria-hidden="true"><span className="approval-choice-radio-dot" /></span>
                  <div className="approval-choice-title">Pick from instructions</div>
                  <div className="approval-choice-desc">
                    {form.desc
                      ? 'Automatically extract affected part numbers from your Redline instructions and add them to this change.'
                      : 'Fill in Redline instructions in Basic Details first to use this option.'}
                  </div>
                </button>
              </div>

              {!form.desc && (
                <div className="approval-tip-card" data-test-id="item-instructions-tip" style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.g800, marginBottom: 4 }}>Tip</div>
                  <div style={{ fontSize: 12, color: T.g600, lineHeight: 1.5 }}>
                    Add Redline instructions in the <strong>Basic Details</strong> step to unlock the <em>Pick from instructions</em> option. Part numbers and assembly names mentioned there will be matched automatically.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Parsing spinner — full-pane centered, shown while analysing instructions ── */}
          {instructionsParsing && (
            <div className="choice-centered-wrap" data-test-id="item-instructions-parsing">
              <Loader2 size={36} className="animate-spin" color={T.brand} style={{ marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0a2233', marginBottom: 6 }}>Analysing redline instructions…</div>
              <div style={{ fontSize: 12, color: T.g500 }}>Matching part numbers and assembly names from the catalog</div>
            </div>
          )}

          {/* ── "Change method" back-link + section heading (when mode is manual) ── */}
          {itemMode === 'manual' && !instructionsParsing && (
            <div data-test-id="eco-items-mode-header">
              <button
                type="button"
                className="eco-back-link"
                onClick={() => setItemMode(null)}
                data-test-id="item-change-method-btn"
              >
                ← Change method
              </button>
              <div style={{ fontWeight: 700, fontSize: 20, color: '#0a2233', marginTop: 8, marginBottom: 4 }}>Add kits &amp; assemblies</div>
              <div className="sub" style={{ fontSize: 13, marginBottom: 16 }}>Search for the kit or assembly whose BOM is changing, then choose how you want to specify the edit for each one.</div>
            </div>
          )}

          <div className="stack" data-test-id="eco-items-section" style={{ display: itemMode === 'manual' && !instructionsParsing ? undefined : 'none' }}>
            {/* Empty state with + Add kit CTA — hidden once picker is open or kits exist */}
            {!kitPickOpen && kits.length === 0 && (
              <div className="eco-kit-catalog-panel" data-test-id="eco-kit-pick-results">
                <div className="eco-kit-empty-dashed" data-test-id="eco-kit-empty-state">
                  <Boxes size={36} color="#b0bec5" style={{ marginBottom: 10 }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#0a2233', marginBottom: 4 }}>No kits added yet</div>
                  <div className="sub" style={{ fontSize: 13, marginBottom: 16 }}>Search the catalog for the kit or assembly whose BOM is changing.</div>
                  <button
                    className="btn pri"
                    onClick={() => { setKitPickOpen(true); setKitPickQ(''); }}
                    data-test-id="eco-add-kit-btn"
                  >
                    <Plus size={13} />Add kit
                  </button>
                </div>
              </div>
            )}

            {/* Search bar + results — shown when picker is open */}
            {kitPickOpen && (
              <div className="eco-kit-catalog-panel" data-test-id="eco-kit-pick-results">
                <div style={{ padding: '10px 10px 6px', borderBottom: '1px solid #e9eef4' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      className="inp" style={{ paddingLeft: 32 }} value={kitPickQ} autoFocus
                      onChange={(e: any) => setKitPickQ(e.target.value)}
                      placeholder="Search kits and assemblies by number or name"
                      data-test-id="eco-kit-pick-search"
                      onBlur={() => { if (!kitPickQ) setTimeout(() => setKitPickOpen(false), 200); }}
                    />
                  </div>
                </div>
                <table className="tbl" data-test-id="eco-kit-pick-table">
                  <thead>
                    <tr>
                      <th>ITEM</th>
                      <th>NAME</th>
                      <th>STATUS</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(allBackendItems ?? ASSEMBLIES as any[])
                      .filter((it: any) => ["KIT", "ASSEMBLY", "PCB"].includes((it.cat || "").toUpperCase()) &&
                        !kits.some((k) => k.pn === it.pn) &&
                        (it.pn + it.name + it.cat).toLowerCase().includes(kitPickQ.toLowerCase()))
                      .slice(0, 20)
                      .map((it: any) => (
                        <tr key={it.pn} data-test-id={`eco-kit-pick-row-${it.pn}`}>
                          <td>
                            <div style={{ fontWeight: 700, fontSize: 13, fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace' }}>{it.pn}</div>
                            <div className="sub" style={{ fontSize: 11 }}>Rev {it.rev}</div>
                          </td>
                          <td style={{ fontWeight: 500 }}>{it.name}</td>
                          <td>{phaseChip(it.phase)}</td>
                          <td>
                            <button className="btn pri sm" onClick={() => { addKit(it); setKitPickQ(''); setKitPickOpen(false); }} data-test-id={`eco-kit-pick-add-${it.pn}`}>
                              + Add
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

              {kits.length > 0 && (
                <div className="stack" style={{ gap: 12 }} data-test-id="eco-kit-list">
                  {kits.map((kit) => {
                    const isExpanded = expandedKits[kit.pn] !== false;
                    const existingBomChildren = bomFor(kit.pn);
                    const totalEdits = kit.bomEdits.length;
                    const adds = kit.bomEdits.filter((e) => e.type === "ADD").length;
                    const dels = kit.bomEdits.filter((e) => e.type === "DELETE").length;
                    const upds = kit.bomEdits.filter((e) => e.type === "UPDATE_DESC" || e.type === "UPDATE_QTY").length;
                    return (
                      <div key={kit.pn} className="card" style={{ padding: 0, overflow: "hidden" }} data-test-id={`eco-kit-card-${kit.pn}`}>
                        {/* Kit header */}
                        <div
                          className="bet"
                          style={{ padding: "12px 16px", cursor: "pointer", borderBottom: isExpanded ? `1px solid ${T.g200}` : "none" }}
                          onClick={() => setExpandedKits((p) => ({ ...p, [kit.pn]: !isExpanded }))}
                          data-test-id={`eco-kit-header-${kit.pn}`}
                        >
                          <div className="row" style={{ gap: 12 }}>
                            {isExpanded ? <ChevronDown size={14} color={T.g500} /> : <ChevronRight size={14} color={T.g500} />}
                            <div>
                              <div className="row" style={{ gap: 8 }}>
                                <span className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 13 }}>{kit.pn}</span>
                                <Chip k="blue">{kit.cat}</Chip>
                                {phaseChip(kit.phase)}
                              </div>
                              <div style={{ fontWeight: 600, fontSize: 13, marginTop: 2 }}>{kit.name}</div>
                            </div>
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            {totalEdits > 0 && (
                              <div className="row" style={{ gap: 4, fontSize: 12, color: T.g600 }}>
                                {adds > 0 && <span style={{ color: "#0B7A4B", fontWeight: 600 }}>+{adds}</span>}
                                {dels > 0 && <span style={{ color: "#B91C1C", fontWeight: 600 }}>−{dels}</span>}
                                {upds > 0 && <span style={{ color: "#92400E", fontWeight: 600 }}>{upds} upd</span>}
                              </div>
                            )}
                            <span className="sub" style={{ fontSize: 12 }}>Rev {kit.currentRev} → Rev {kit.newRev}</span>
                            <button
                              className="btn gh sm"
                              onClick={(e) => { e.stopPropagation(); removeKit(kit.pn); }}
                              data-test-id={`eco-kit-remove-${kit.pn}`}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ padding: "14px 16px" }}>
                            {/* Rev range & edit mode */}
                            <div className="row" style={{ gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                                <span className="sub" style={{ fontSize: 12 }}>Current rev</span>
                                <Input
                                  style={{ height: 28, width: 60, textAlign: "center" }}
                                  value={kit.currentRev}
                                  onChange={(e: any) => updateKit(kit.pn, { currentRev: e.target.value })}
                                  data-test-id={`eco-kit-current-rev-${kit.pn}`}
                                />
                                <span className="sub">→</span>
                                <span className="sub" style={{ fontSize: 12 }}>New rev</span>
                                <Input
                                  style={{ height: 28, width: 60, textAlign: "center" }}
                                  value={kit.newRev}
                                  onChange={(e: any) => updateKit(kit.pn, { newRev: e.target.value })}
                                  data-test-id={`eco-kit-new-rev-${kit.pn}`}
                                />
                              </div>
                              <div className="seg" style={{ height: 28 }}>
                                <button
                                  className={kit.editMode === "inline" ? "on" : ""}
                                  onClick={() => updateKit(kit.pn, { editMode: "inline" })}
                                  data-test-id={`eco-kit-mode-inline-${kit.pn}`}
                                >
                                  <FileText size={12} />Enter inline
                                </button>
                                <button
                                  className={kit.editMode === "file" ? "on" : ""}
                                  onClick={() => updateKit(kit.pn, { editMode: "file" })}
                                  data-test-id={`eco-kit-mode-file-${kit.pn}`}
                                >
                                  <Upload size={12} />Upload file
                                </button>
                              </div>
                            </div>

                            {kit.editMode === "file" ? (
                              /* File upload mode */
                              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                <div
                                  style={{
                                    border: `2px dashed ${T.g200}`, borderRadius: 8, padding: "20px 16px",
                                    textAlign: "center", cursor: "pointer", background: T.g50,
                                  }}
                                  onClick={() => { setActiveKitFilePn(kit.pn); kitFileInputRef.current?.click(); }}
                                  data-test-id={`eco-kit-file-drop-${kit.pn}`}
                                >
                                  <Upload size={18} color={T.g400} style={{ margin: "0 auto 6px" }} />
                                  <div style={{ fontSize: 13, color: T.g700, fontWeight: 600 }}>Drop redline file here or click to browse</div>
                                  <div className="sub" style={{ marginTop: 4 }}>PDF, Excel, CSV — your BOM redline for {kit.pn}</div>
                                </div>
                                {kit.bomFile && (
                                  <div className="row" style={{ gap: 10, padding: "8px 12px", background: "#F0FDF4", borderRadius: 6, border: "1px solid #BBF7D0" }}>
                                    <CheckCircle2 size={14} color="#0B7A4B" />
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{kit.bomFile.n}</span>
                                    <span className="sub">{kit.bomFile.size}</span>
                                    <button className="btn gh sm" style={{ marginLeft: "auto" }} onClick={() => updateKit(kit.pn, { bomFile: null })}><X size={11} /></button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Inline BOM edit mode */
                              <div className="stack" style={{ gap: 8 }}>
                                {/* Existing BOM children as quick-add reference */}
                                {existingBomChildren.length > 0 && kit.bomEdits.length === 0 && (
                                  <div style={{ padding: "10px 12px", background: T.g50, borderRadius: 6, border: `1px solid ${T.g200}` }}>
                                    <div className="sub" style={{ marginBottom: 8, fontWeight: 600 }}>Current BOM children — click to add an edit</div>
                                    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                                      {existingBomChildren.slice(0, 8).map((child: any) => (
                                        <button
                                          key={child.pn}
                                          className="btn sm gh"
                                          onClick={() => addBomEditFromChild(kit.pn, child, "DELETE")}
                                          data-test-id={`eco-kit-child-quick-${kit.pn}-${child.pn}`}
                                        >
                                          <Trash2 size={11} />−{child.pn}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Existing edits */}
                                {kit.bomEdits.length > 0 && (
                                  <table className="tbl" data-test-id={`eco-kit-edits-table-${kit.pn}`}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: 120 }}>Change type</th>
                                        <th>Item number</th>
                                        <th>Item name</th>
                                        <th>Qty / Value</th>
                                        <th></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {kit.bomEdits.map((edit) => (
                                        <React.Fragment key={edit.id}>
                                          <tr data-test-id={`eco-kit-edit-row-${edit.id}`}>
                                            <td>
                                              {edit.type === "ADD" && <Chip k="ok">Add</Chip>}
                                              {edit.type === "DELETE" && <Chip k="bad">Delete</Chip>}
                                              {(edit.type === "UPDATE_DESC" || edit.type === "UPDATE_QTY") && <Chip k="warn">Update</Chip>}
                                            </td>
                                            <td className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}>
                                              {edit.pn}
                                            </td>
                                            <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{edit.name}</td>
                                            <td className="sub">
                                              {edit.type === "ADD" || edit.type === "DELETE" ? edit.qty
                                                : edit.type === "UPDATE_QTY" ? `→ ${edit.newValue}`
                                                : edit.newValue ? `→ "${edit.newValue.slice(0, 30)}${edit.newValue.length > 30 ? "…" : ""}"` : "—"}
                                            </td>
                                            <td style={{ textAlign: "right" }}>
                                              <button className="btn gh sm" onClick={() => removeBomEdit(kit.pn, edit.id)} data-test-id={`eco-kit-edit-remove-${edit.id}`}>
                                                <Trash2 size={12} />
                                              </button>
                                            </td>
                                          </tr>
                                        </React.Fragment>
                                      ))}
                                    </tbody>
                                  </table>
                                )}

                                {/* Add edit inline form */}
                                {editingBomEdit?.kitPn === kit.pn ? (
                                  <div style={{ padding: "12px 14px", background: T.g50, borderRadius: 8, border: `1px solid ${T.g200}` }} data-test-id={`eco-kit-edit-form-${kit.pn}`}>
                                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
                                      <div style={{ width: 150 }}>
                                        <Field label="Change type">
                                          <Select
                                            value={bomEditDraft.type || "ADD"}
                                            onChange={(e: any) => setBomEditDraft((p) => ({ ...p, type: e.target.value as BomEditType }))}
                                            options={["ADD", "DELETE", "UPDATE_DESC", "UPDATE_QTY"]}
                                            data-test-id="eco-edit-type-select"
                                          />
                                        </Field>
                                      </div>
                                      <div style={{ width: 160 }}>
                                        <Field label="Part number">
                                          <Input
                                            value={bomEditDraft.pn || ""}
                                            onChange={(e: any) => setBomEditDraft((p) => ({ ...p, pn: e.target.value }))}
                                            placeholder="e.g. 1006394-01"
                                            data-test-id="eco-edit-pn-input"
                                          />
                                        </Field>
                                      </div>
                                      <div style={{ flex: 1, minWidth: 180 }}>
                                        <Field label="Item name">
                                          <Input
                                            value={bomEditDraft.name || ""}
                                            onChange={(e: any) => setBomEditDraft((p) => ({ ...p, name: e.target.value }))}
                                            placeholder="e.g. WASHER FLAT M5"
                                            data-test-id="eco-edit-name-input"
                                          />
                                        </Field>
                                      </div>
                                      {(bomEditDraft.type === "ADD" || bomEditDraft.type === "DELETE") && (
                                        <div style={{ width: 90 }}>
                                          <Field label="Qty">
                                            <Input
                                              value={bomEditDraft.qty || ""}
                                              onChange={(e: any) => setBomEditDraft((p) => ({ ...p, qty: e.target.value }))}
                                              placeholder="e.g. 4 EA"
                                              data-test-id="eco-edit-qty-input"
                                            />
                                          </Field>
                                        </div>
                                      )}
                                      {(bomEditDraft.type === "UPDATE_DESC" || bomEditDraft.type === "UPDATE_QTY") && (
                                        <div style={{ width: 200 }}>
                                          <Field label={bomEditDraft.type === "UPDATE_DESC" ? "New description" : "New qty"}>
                                            <Input
                                              value={bomEditDraft.newValue || ""}
                                              onChange={(e: any) => setBomEditDraft((p) => ({ ...p, newValue: e.target.value }))}
                                              placeholder={bomEditDraft.type === "UPDATE_DESC" ? "New description text…" : "e.g. 6 EA"}
                                              data-test-id="eco-edit-newvalue-input"
                                            />
                                          </Field>
                                        </div>
                                      )}
                                    </div>
                                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                                      <button
                                        className="btn pri sm"
                                        disabled={!bomEditDraft.pn}
                                        onClick={commitBomEdit}
                                        data-test-id="eco-edit-commit-btn"
                                      >
                                        <Check size={12} />Add edit
                                      </button>
                                      <button className="btn sm" onClick={() => { setEditingBomEdit(null); setBomEditDraft({}); }} data-test-id="eco-edit-cancel-btn">
                                        Cancel
                                      </button>
                                      <span className="sub" style={{ fontSize: 12, marginLeft: 4 }}>
                                        Or search existing children:
                                      </span>
                                      <button className="btn sm gh" onClick={() => setKitChildPickOpen(kit.pn)} data-test-id={`eco-kit-child-pick-${kit.pn}`}>
                                        <Search size={12} />Pick from BOM
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="row" style={{ gap: 8 }}>
                                    {(["ADD", "DELETE", "UPDATE_DESC", "UPDATE_QTY"] as BomEditType[]).map((t) => (
                                      <button
                                        key={t}
                                        className="btn sm gh"
                                        onClick={() => openBomEditDraft(kit.pn, t)}
                                        data-test-id={`eco-kit-add-edit-${kit.pn}-${t}`}
                                      >
                                        <Plus size={11} />{BOM_EDIT_LABELS[t]}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
   

            {/* Kit child BOM picker for inline edits */}
            {kitChildPickOpen && (
              <Modal
                title={`Pick child from BOM — ${kitChildPickOpen}`}
                wide
                onClose={() => { setKitChildPickOpen(null); setKitChildQ(""); }}
                data-test-id="eco-kit-child-pick-modal"
              >
                <div style={{ position: "relative", marginBottom: 12 }}>
                  <Search size={13} color={T.g500} style={{ position: "absolute", left: 9, top: 10 }} />
                  <input
                    className="inp" style={{ paddingLeft: 28 }} autoFocus value={kitChildQ}
                    onChange={(e: any) => setKitChildQ(e.target.value)}
                    placeholder="Filter by part number or name"
                    data-test-id="eco-kit-child-pick-search"
                  />
                </div>
                <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${T.g200}`, borderRadius: 6 }}>
                  <table className="tbl">
                    <thead><tr><th>Item number</th><th>Rev</th><th>Item name</th><th>Category</th><th>Qty</th><th></th></tr></thead>
                    <tbody>
                      {bomFor(kitChildPickOpen)
                        .filter((c: any) => (c.pn + c.name).toLowerCase().includes(kitChildQ.toLowerCase()))
                        .map((child: any) => (
                          <tr key={child.pn} data-test-id={`eco-kit-child-row-${child.pn}`}>
                            <td className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}>{child.pn}</td>
                            <td>{child.rev}</td>
                            <td>{child.name}</td>
                            <td className="sub">{child.cat}</td>
                            <td>{child.qty}</td>
                            <td>
                              <div className="row" style={{ gap: 4 }}>
                                <button className="btn sm" onClick={() => { addBomEditFromChild(kitChildPickOpen, child, "DELETE"); setKitChildPickOpen(null); setKitChildQ(""); }} data-test-id={`eco-kit-child-delete-${child.pn}`}><Trash2 size={11} />Delete</button>
                                <button className="btn sm" onClick={() => { addBomEditFromChild(kitChildPickOpen, child, "UPDATE_QTY"); setKitChildPickOpen(null); setKitChildQ(""); }} data-test-id={`eco-kit-child-updateqty-${child.pn}`}>Upd qty</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {bomFor(kitChildPickOpen).length === 0 && (
                        <tr><td colSpan={6}><Empty icon={Boxes} title="No BOM children found" body="This kit has no children in the current data." /></td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Modal>
            )}

            {/* Hidden file input for kit BOM files */}
            <input
              ref={kitFileInputRef}
              type="file"
              multiple={false}
              accept=".pdf,.xlsx,.xls,.csv,.docx"
              style={{ display: "none" }}
              aria-hidden="true"
              data-test-id="eco-kit-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f || !activeKitFilePn) return;
                const kitPn = activeKitFilePn;
                const staged: StagedFile = {
                  n: f.name,
                  size: f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
                  fileType: "Drawing",
                  visibility: "Internal only",
                };
                // Parse Excel/CSV files for BOM edits
                if (/\.(xlsx|xls|csv)$/i.test(f.name)) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const buf = ev.target?.result as ArrayBuffer;
                    const catalogPns = new Set<string>(
                      ((allBackendItems ?? []) as any[])
                        .concat(ITEMS as any[])
                        .map((it: any) => String(it.pn ?? '').toUpperCase())
                    );
                    const { edits, parseError } = parseBomExcel(buf, catalogPns);
                    if (parseError) {
                      toast.error(parseError);
                      updateKit(kitPn, { bomFile: staged });
                    } else {
                      toast.success(`Parsed ${edits.length} BOM edit${edits.length !== 1 ? 's' : ''} from ${f.name}`);
                      updateKit(kitPn, { bomFile: staged, bomEdits: edits, editMode: 'inline' });
                    }
                  };
                  reader.readAsArrayBuffer(f);
                } else {
                  // PDF / DOCX — just store as reference file
                  updateKit(kitPn, { bomFile: staged });
                }
                setActiveKitFilePn(null);
                e.target.value = "";
              }}
            />

            {ecoItems.length > 0 && (
              <div className="note" data-test-id="eco-items-count-note">
                <b>{ecoItems.length} kit{ecoItems.length !== 1 ? "s" : ""} on this change</b>
                {kits.length > 0 && ` · ${kits.reduce((a, k) => a + k.bomEdits.length, 0)} BOM edits across ${kits.length} kit${kits.length !== 1 ? "s" : ""}`}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Approvals */}
      {i === 2 && (
        <div className="stack" data-test-id="eco-new-approvals-step">
          {!mode ? (
            <div data-test-id="approval-method-selection">
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0a2233', marginBottom: 4 }}>Select Approval Method</div>
              <div className="sub" style={{ fontSize: 12, marginBottom: 20 }}>Choose how reviewer stages should be determined for this change order</div>
              <div className="approval-choice-grid" data-test-id="approval-choices-grid">
                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => setMode("routing")}
                  data-test-id="approval-choice-routing"
                >
                  <span className="approval-choice-radio" aria-hidden="true"><span className="approval-choice-radio-dot" /></span>
                  <div className="approval-choice-title">Predefined routing</div>
                  <div className="approval-choice-desc">
                    Apply standard pre-configured routing templates from Workspace Admin with cross-functional roles.
                  </div>
                </button>

                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => { setMode("ai"); setAiState("idle"); setAiSuggestions([]); aiReset(); }}
                  data-test-id="approval-choice-ai"
                >
                  <span className="approval-choice-radio" aria-hidden="true"><span className="approval-choice-radio-dot" /></span>
                  <div className="approval-choice-title">Assistant suggestion</div>
                  <div className="approval-choice-desc">
                    AI evaluates part category, division, site, and previous changes to recommend required reviewers.
                  </div>
                </button>

                <button
                  type="button"
                  className="approval-choice-card"
                  onClick={() => setMode("manual")}
                  data-test-id="approval-choice-manual"
                >
                  <span className="approval-choice-radio" aria-hidden="true"><span className="approval-choice-radio-dot" /></span>
                  <div className="approval-choice-title">Build manually</div>
                  <div className="approval-choice-desc">
                    Construct custom sequential stages from scratch and assign specific team members for this change.
                  </div>
                </button>
              </div>

              <div className="approval-tip-card" data-test-id="approval-selection-tip">
                <div style={{ fontSize: 12, fontWeight: 700, color: T.g800, marginBottom: 4 }}>Tip</div>
                <div style={{ fontSize: 12, color: T.g600, lineHeight: 1.5 }}>
                  Standard routings automatically apply company SOPs and required cross-functional department sign-offs. You can customize stages and add members in any mode.
                </div>
              </div>
            </div>
          ) : (
            <div data-test-id="eco-approvals-configured">
              <div className="bet" style={{ marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#0a2233', marginBottom: 2 }}>Approvals</div>
                  <div className="sub" style={{ fontSize: 12 }}>Configure reviewer stages and sign-off requirements</div>
                </div>
                <button
                  type="button"
                  className="btn sm gh"
                  onClick={() => setMode(null)}
                  data-test-id="change-approval-method-btn"
                >
                  <ChevronLeft size={12} />Change method
                </button>
              </div>
              <div className="row" style={{ gap: 6, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #E2E8F0" }}>
                <span className="sub" style={{ fontSize: 12 }}>Method:</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0a2233' }}>
                  {mode === "routing" ? "Standard Routing" : mode === "ai" ? "Assistant Suggestion" : "Manual Flow"}
                </span>
                {mode === "ai" && <Chip k="vio" icon={Sparkles}>AI Powered</Chip>}
                {mode === "routing" && <Chip k="blue" icon={Layers}>Standard</Chip>}
                {mode === "manual" && <Chip k="gray" icon={Users}>Manual</Chip>}
              </div>

              {mode === "ai" && (
                <div className="stack" data-test-id="ai-approval-section">

                  {/* ── IDLE: prompt to run ── */}
                  {aiState === "idle" && (
                    <div className="aibox" style={{ textAlign: "center", padding: "28px 20px" }} data-test-id="ai-approval-idle">
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <Sparkles size={22} color={T.vio} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>AI Approval Flow Generator</div>
                      <div className="sub" style={{ marginBottom: 16, maxWidth: 420, margin: "0 auto 16px" }}>
                        Analyses your change — division, category, part history, redlines — and suggests the right approvers with confidence scores and reasoning.
                      </div>
                      <button
                        className="btn pri"
                        onClick={runAiSuggest}
                        data-test-id="ai-approval-run-btn"
                      >
                        <Sparkles size={13} />
                        Generate approval flow
                      </button>
                    </div>
                  )}

                  {/* ── LOADING ── */}
                  {aiState === "loading" && (
                    <div className="aibox" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "32px 20px" }} data-test-id="ai-approval-loading">
                      <Loader2 size={22} color={T.vio} className="animate-spin" />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Analysing your change…</div>
                      <div className="sub">Reading part history, division rules, and SOP-DC-004</div>
                      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                        {[90, 75, 60, 80, 50].map((w, idx) => (
                          <div key={idx} style={{ height: 32, background: T.g100, borderRadius: 6, overflow: "hidden", position: "relative" }} data-test-id={`ai-loading-skeleton-${idx}`}>
                            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, ${T.g100}, ${T.g200}, ${T.g100})`, animation: "shimmer 1.4s infinite", backgroundSize: "200% 100%" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── ERROR ── */}
                  {aiState === "error" && (
                    <div className="aibox" style={{ borderColor: T.bad, textAlign: "center", padding: "28px 20px" }} data-test-id="ai-approval-error">
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
                        <AlertCircle size={22} color={T.bad} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: T.bad, marginBottom: 6 }}>Couldn't generate suggestions</div>
                      <div className="sub" style={{ marginBottom: 16 }}>
                        The AI service returned an error. Your change details are intact — try again and it will re-analyse.
                      </div>
                      <button
                        className="btn pri"
                        onClick={runAiSuggest}
                        disabled={aiLoading}
                        data-test-id="ai-approval-retry-btn"
                      >
                        {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        Try again
                      </button>
                    </div>
                  )}

                  {/* ── DONE: stage-grouped results ── */}
                  {aiState === "done" && (
                    <>
                      <div className="aibox" data-test-id="ai-approval-result-header">
                        <div className="row" style={{ marginBottom: 8, justifyContent: "space-between" }}>
                          <div className="row">
                            <Sparkles size={15} color={T.vio} />
                            <b>Suggested approvers for {coId}</b>
                            <Chip k="vio">Suggestion only — you decide</Chip>
                          </div>
                          <button
                            type="button"
                            className="btn sm gh"
                            onClick={runAiSuggest}
                            disabled={aiLoading}
                            title="Re-generate suggestions"
                            data-test-id="ai-approval-rerun-btn"
                          >
                            {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            Regenerate
                          </button>
                        </div>
                        <div className="sub">
                          Based on SOP-DC-004, the division and category of the items on this change, and approver patterns from prior ECOs.
                        </div>
                      </div>

                      {[1, 2].map((st) => {
                        const rows = aiSuggestions.filter((r) => r.stage === st);
                        if (!rows.length) return null;
                        const isCollapsed = Boolean(collapsedStages[`ai-${st}`]);
                        const stageLabel = st === 1 ? "Functional approval" : "Document control sign-off";
                        const checkedCount = rows.filter((r) => picked.includes(r.g)).length;
                        return (
                          <div key={st} className="eco-stage-card" data-test-id={`ai-stagecard-${st}`}>
                            <div
                              className="eco-stage-head"
                              onClick={() => toggleStageCollapse(`ai-${st}`)}
                              data-test-id={`ai-stage-toggle-${st}`}
                            >
                              <ChevronDown size={14} color={T.g500} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: 14, color: '#0a2233' }}>{st}.&nbsp;&nbsp;{stageLabel}</span>
                              <span className="sub" style={{ fontSize: 12, marginLeft: 8 }}>{checkedCount} of {rows.length} selected</span>
                              <Chip k="vio" icon={Sparkles}>AI suggested</Chip>
                            </div>

                            {!isCollapsed && (
                              <div className="eco-stage-body" data-test-id={`ai-stage-table-${st}`}>
                                {rows.map((a2) => {
                                  const on = picked.includes(a2.g);
                                  return (
                                    <div key={a2.g} className="eco-role-row" data-test-id={`ai-suggestion-row-${a2.g}`}>
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => setPicked(on ? picked.filter((x) => x !== a2.g) : [...picked, a2.g])}
                                        aria-label={`Include ${a2.g}`}
                                        style={{ flexShrink: 0, marginRight: 12 }}
                                      />
                                      <span style={{ fontWeight: 600, fontSize: 13, flex: '0 0 220px' }}>{a2.g}</span>
                                      <span className="sub" style={{ flex: '0 0 160px', fontSize: 13 }}>{a2.who}</span>
                                      <span style={{ flex: '0 0 110px' }}>
                                        <Chip k={a2.req === "One or more" ? "blue" : a2.req === "Optional" ? "gray" : a2.req === "Comments only" ? "gray" : "vio"}>
                                          {a2.req}
                                        </Chip>
                                      </span>
                                      <span
                                        style={{ fontSize: 13, fontWeight: 700, color: a2.conf > 80 ? T.ok : a2.conf > 60 ? T.warn : T.g400, cursor: 'help' }}
                                        title={a2.why}
                                        aria-label={`Confidence ${a2.conf}% — ${a2.why}`}
                                      >
                                        {a2.conf}%
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                </div>
              )}

              {mode === "routing" && (
                <div className="stack">
                  {/* Routing selector row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: T.g500, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>ROUTING</div>
                    <div style={{ flex: 1, maxWidth: 360 }}>
                      <Select value={routing} onChange={(e: any) => setRouting(e.target.value)} options={routingOptions} style={{ fontWeight: 700 }} />
                    </div>
                    <div className="sub" style={{ fontSize: 12 }}>
                      Matched on <b>Division {form.div.split('–')[0].trim()} · category {kits[0]?.cat ?? 'KIT'}</b> · {selectedStages.length} stage{selectedStages.length !== 1 ? 's' : ''}, {selectedStages.length} role{selectedStages.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Stage cards — numbered, bordered, with role rows */}
                  {[1, 2, 3].map((st: any) => {
                    const rows = selectedStages.filter((r: any) => r.stage === st);
                    if (!rows.length) return null;
                    const isCollapsed = Boolean(collapsedStages[`routing-${st}`]);
                    const stageNames: Record<number, string> = { 1: 'Engineering review', 2: 'Regulatory sign-off', 3: 'Document control sign-off' };
                    const stageLabel = stageNames[st] ?? (st === 1 ? 'Functional approval' : 'Document control sign-off');
                    return (
                      <div key={st} className="eco-stage-card" data-test-id={`routing-stagecard-${st}`}>
                        <div
                          className="eco-stage-head"
                          onClick={() => toggleStageCollapse(`routing-${st}`)}
                          data-test-id={`routing-stage-toggle-${st}`}
                        >
                          <ChevronDown size={14} color={T.g500} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#0a2233' }}>{st}.&nbsp;&nbsp;{stageLabel}</span>
                          <span className="sub" style={{ fontSize: 12, marginLeft: 8 }}>{rows.length} role{rows.length !== 1 ? 's' : ''}</span>
                        </div>
                        {!isCollapsed && (
                          <div className="eco-stage-body">
                            {rows.map((r: any) => (
                              <div key={r.g} className="eco-role-row" data-test-id={`routing-role-row-${r.g}`}>
                                <span style={{ fontWeight: 600, fontSize: 13, flex: '0 0 260px' }}>{r.g}</span>
                                <span className="sub" style={{ flex: '0 0 120px', fontSize: 13 }}>{r.req}</span>
                                <span className="sub" style={{ fontSize: 13 }}>{(r.members ?? []).join(', ')}</span>
                              </div>
                            ))}
                            <button type="button" className="eco-add-role-link" data-test-id={`routing-add-role-${st}`}>
                              + Add role
                            </button>
                          </div>
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
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Summary */}
      {i === 3 && (
        <div className="stack" data-test-id="eco-new-summary-step">

          {/* ── Header card: DRAFT + type + title + stats ── */}
          <div className="eco-summary-header-card" data-test-id="eco-summary-header">
            <div className="eco-summary-header-left">
              <div className="row" style={{ gap: 8, marginBottom: 7, alignItems: 'center' }}>
                <span className="eco-draft-chip">DRAFT</span>
                <span style={{ fontSize: 13, color: '#3b6ea8', fontWeight: 600 }}>{form.cat.includes(':') ? form.cat.split(':')[1]?.trim() : form.cat}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#0a2233', lineHeight: 1.3 }}>
                {form.title || 'New change order'}
              </div>
            </div>
            <div className="eco-summary-stats">
              {[
                ['ITEMS', ecoItems.length],
                ['STAGES', mode === 'manual' ? manStages.length : (selectedStages.filter((r: any, idx2: number, arr: any[]) => arr.findIndex((x: any) => x.stage === r.stage) === idx2).length || 1)],
                ['APPROVERS', mode === 'ai' ? picked.length : mode === 'manual' ? manStages.reduce((a2: any, x: any) => a2 + x.people.length, 0) : selectedStages.length]
              ].map(([label, val]: any) => (
                <div key={label} className="eco-summary-stat-box">
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#0a2233', lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7993a8', marginTop: 5 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Items on this change ── */}
          <div className="eco-summary-section" data-test-id="eco-summary-items-section">
            <div className="eco-summary-section-head">
              <span className="eco-summary-section-title">Items on this change ({ecoItems.length})</span>
              <button className="eco-summary-edit-link" onClick={() => setI(1)} data-test-id="summary-edit-items-btn">Edit</button>
            </div>
            {ecoItems.length === 0 ? (
              <Empty icon={Boxes} title="No items yet" body="Go back to step 1 and add some." />
            ) : (
              <table className="tbl" data-test-id="summary-items-table">
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>NAME</th>
                    <th>REV CHANGE</th>
                    <th>BOM EDITS</th>
                  </tr>
                </thead>
                <tbody>
                  {ecoItems.map((r: any, k: any) => {
                    const isKit = r.src === 'Kit';
                    const adds = isKit ? (r.bomEdits || []).filter((e: any) => e.type === 'ADD').length : 0;
                    const dels = isKit ? (r.bomEdits || []).filter((e: any) => e.type === 'DELETE').length : 0;
                    const upds = isKit ? (r.bomEdits || []).filter((e: any) => e.type === 'UPDATE_DESC' || e.type === 'UPDATE_QTY').length : 0;
                    return (
                      <tr key={r.pn + k} data-test-id={`summary-item-row-${r.pn}`}>
                        <td style={{ fontWeight: 700, fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 13 }}>{r.pn}</td>
                        <td style={{ fontWeight: 500 }}>{r.name}</td>
                        <td>{isKit ? <span className="sub">{r.currentRev} → {r.newRev}</span> : <span className="mut">—</span>}</td>
                        <td>
                          {isKit ? (
                            <span className="sub">
                              {adds === 0 && dels === 0 && upds === 0 && !r.bomFile ? 'No edits yet' :
                                [adds > 0 && `+${adds} add`, dels > 0 && `−${dels} del`, upds > 0 && `${upds} upd`, r.bomFile && 'File'].filter(Boolean).join(' · ')}
                            </span>
                          ) : <span className="mut">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Approval routing ── */}
          <div className="eco-summary-section" data-test-id="eco-summary-approvals-section">
            <div className="eco-summary-section-head">
              <span className="eco-summary-section-title">Approval routing</span>
              <button className="eco-summary-edit-link" onClick={() => setI(2)} data-test-id="summary-edit-approvals-btn">Edit</button>
            </div>
            <div className="sub" style={{ fontSize: 12, marginBottom: 10 }}>
              {mode === 'routing' ? `Predefined routing — ${routing}` : mode === 'ai' ? 'Assistant suggestion, editable' : 'Built manually'}
            </div>
            {mode === 'manual' ? manStages.map((st: any, k: any) => (
              <div key={k} className="eco-summary-stage-row" data-test-id={`summary-routing-stage-${k}`}>
                <span style={{ fontWeight: 700 }}>{k + 1}. {st.name}</span>
                <div className="sub" style={{ marginTop: 2 }}>{st.people.join(', ') || 'No one selected'} — {st.req}</div>
              </div>
            )) : (
              <>
                {selectedStages.filter((r: any, idx3: number, arr: any[]) => arr.findIndex((x: any) => x.stage === r.stage) === idx3).map((stageRow: any) => {
                  const stageNum = stageRow.stage;
                  const stageRoles = selectedStages.filter((r: any) => r.stage === stageNum);
                  const stageNamesMap: Record<number, string> = { 1: 'Engineering sign-off', 2: 'Regulatory sign-off', 3: 'Document control sign-off' };
                  return (
                    <div key={stageNum} className="eco-summary-stage-row" data-test-id={`summary-routing-stage-${stageNum}`}>
                      <span style={{ fontWeight: 700 }}>{stageNum}. {stageNamesMap[stageNum] ?? `Stage ${stageNum}`}</span>
                      <div className="sub" style={{ marginTop: 2 }}>
                        {stageRoles.map((r: any) => `${r.g} — ${r.req}, ${(r.members ?? []).join(', ')}`).join(' · ')}
                      </div>
                    </div>
                  );
                })}
                {!selectedStages.length && (
                  <div className="eco-summary-stage-row" data-test-id="summary-routing-stage-1">
                    <span style={{ fontWeight: 700 }}>1. Engineering sign-off</span>
                    <div className="sub" style={{ marginTop: 2 }}>
                      {mode === 'ai' ? picked.join(' · ') : 'Engineering Lead – Livermore — One or more, Dana Kim'}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Additional details (collapsible) ── */}
          <div className="eco-summary-section" data-test-id="eco-summary-additional-section">
            <div
              className="eco-summary-section-head"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setCollapsedStages((p: any) => ({ ...p, 'summary-additional': !p['summary-additional'] }))}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ChevronDown size={14} color="#7993a8" style={{ transform: collapsedStages['summary-additional'] ? 'rotate(-90deg)' : 'none', transition: 'transform .15s' }} />
                <span className="eco-summary-section-title">Additional details</span>
              </span>
              <span className="sub" style={{ fontSize: 12 }}>Division, site, compliance &amp; ownership</span>
            </div>
            {!collapsedStages['summary-additional'] && (
              <div className="eco-summary-kv-grid" style={{ marginTop: 14 }}>
                {[
                  ['CHANGE CATEGORY', form.cat.split(':')[0]],
                  ['DIVISION', form.div],
                  ['SITE / PLANT', form.site],
                  ['EFFECTIVITY', form.eff],
                  ['INVENTORY DISPOSITION FILLED?', confirmations.disposition],
                  ['CHANGE CREATOR', ME.name],
                ].map(([label, val]: any) => (
                  <div key={label} className="eco-summary-kv-item" data-test-id={`summary-kv-${label}`}>
                    <span className="eco-summary-kv-label">{label}</span>
                    <span className="eco-summary-kv-value">{val || '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Bottom action bar — visible on ALL steps (suppressed in modal mode) ── */}
      {!isModal && (
      <div className="bet" data-test-id="eco-wizard-footer">
        <button className="btn" onClick={back} disabled={isSubmitting} data-test-id="eco-wizard-back-btn">
          <ChevronLeft size={13} />{i === 0 ? "Cancel" : "Back"}
        </button>
        <div className="row">
          {/* Hint text */}
          {i === 0 && (
            <span className="mini" style={{ marginRight: 6 }}>
              {!isGeneralFilled ? "Change Details incomplete — fill required fields"
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

          {/* Steps 0–2: Continue advances the wizard */}
          {i < 3 && (
            <button
              className="btn pri"
              onClick={next}
              disabled={(i === 0 && !isGeneralFilled) || (i === 1 && ecoItems.length === 0) || (i === 2 && !mode)}
              data-test-id="eco-wizard-continue-btn"
            >
              Continue <ChevronRight size={13} />
            </button>
          )}

          {/* Step 3: single create action — ECOs go directly into the approval flow */}
          {i === 3 && (
            <button
              className="btn pri"
              onClick={handleCreate}
              disabled={isSubmitting}
              data-test-id="eco-create-submit-btn"
            >
              {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Create &amp; submit to routing
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
        title="New change order"
        steps={ECO_WIZARD_STEPS}
        currentStep={i}
        onStepClick={(idx) => { if (idx < i) setI(idx); }}
        onClose={onClose ?? (() => go({ page: "ecos" }))}
        foot={modalFoot}
        data-test-id="eco-new-modal"
      >
        {content}
      </WizardModal>
    );
  }

  return content;
}

export { EcoNew }


