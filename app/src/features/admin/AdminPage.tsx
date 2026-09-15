import { CsvImport } from '@/components/data-io/CsvImport'
import { IdMemberPicker } from '@/components/pickers/IdMemberPicker'
import { Card } from '@/components/primitives/Card'
import { Chip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { PlmForm, useCreateForm, useCreateRole, useCreateRouting, useCreateUser, useDeleteForm, useDeleteRole, useDeleteRouting, useDeleteUser, useForms, useRoles, useRoutings, useUpdateForm, useUpdateRole, useUpdateRouting, useUpdateUser, useUsers } from '@/data/admin'
import { FIELD_TYPES } from '@/domain/adminSeed'
import { GROUPS } from '@/domain/people'
import { T } from '@/theme/tokens'
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Database, Layers, Loader2, Pencil, Plus, ShieldCheck, Sliders, Trash2, Upload, Users } from 'lucide-react'
import React, { useState } from 'react'
import { toast } from 'sonner'

function Admin({
  initialTab = "Users",
  go,
  renderHeaderActions,
}: {
  initialTab?: string;
  go?: any;
  renderHeaderActions?: () => React.ReactNode;
}) {
  const normalizeAdminTab = (t?: string) => {
    if (!t) return "Users";
    if (t === "Roles" || t === "Approval roles") return "Roles";
    if (t === "Routings") return "Routings";
    if (t === "Form Builder" || t === "Change form builder") return "Form Builder";
    return "Users";
  };

  const [tab, setTab] = useState(() => normalizeAdminTab(initialTab));

  React.useEffect(() => {
    if (initialTab) {
      setTab(normalizeAdminTab(initialTab));
    }
  }, [initialTab]);

  /* users — backend */
  const { users: backendUsers, loading: usersLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const [userModal, setUserModal] = useState<any>(null);
  const [userSaving, setUserSaving] = useState(false);
  const [invite, setInvite] = useState(false);
  const [uq, setUq] = useState("");
  const [useg, setUseg] = useState("All");

  /* roles — backend */
  const { roles: backendRoles, loading: rolesLoading } = useRoles();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const [roleModal, setRoleModal] = useState<any>(null);
  const [rq, setRq] = useState("");

  /* routings — backend */
  const { routings: backendRoutings, loading: routingsLoading } = useRoutings();
  const createRouting = useCreateRouting();
  const updateRouting = useUpdateRouting();
  const deleteRouting = useDeleteRouting();
  const [routeModal, setRouteModal] = useState<any>(null);
  const [tq, setTq] = useState("");

  /* pagination */
  const [userPage, setUserPage] = useState(0);
  const [rolePage, setRolePage] = useState(0);
  const [routePage, setRoutePage] = useState(0);
  const [formPage, setFormPage] = useState(0);

  /* form builder — backend */
  const { forms: backendForms, loading: formsLoading } = useForms();
  const createFormMutation = useCreateForm();
  const updateFormMutation = useUpdateForm();
  const deleteFormMutation = useDeleteForm();

  const [previewPaneFormId, setPreviewPaneFormId] = useState<string | null>(null);
  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  // Tracks the name + description of the form currently open in the editor so that
  // saveCurrentForm never needs to look it up in backendForms (which may be stale
  // right after a create, causing the guard to bail out silently).
  const [activeFormMeta, setActiveFormMeta] = useState<{ name: string; description: string } | null>(null);
  const [formSearchQuery, setFormSearchQuery] = useState("");
  const [newFormModal, setNewFormModal] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [newFormType, setNewFormType] = useState("ECO: Engineering Change Order");
  const [newFormDesc, setNewFormDesc] = useState("");

  const [formSections, setFormSections] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [formViewMode, setFormViewMode] = useState<"builder" | "preview">("builder");
  const [sectionModal, setSectionModal] = useState<{ name: string; isNew: boolean; oldName?: string } | null>(null);
  const [selectedFormType, setSelectedFormType] = useState("ECO: Engineering Change Order");
  const [fields, setFields] = useState<Array<{ l: string; t: string; req: boolean; sap: boolean; sec: string; opts?: string[] }>>([]);

  const openFormEditor = (form: PlmForm) => {
    setActiveFormId(form.id);
    setActiveFormMeta({ name: form.name, description: form.description });
    setSelectedFormType(form.type);
    try { setFormSections(JSON.parse(form.sectionsJson || "[]")); } catch { setFormSections([]); }
    try { setFields(JSON.parse(form.fieldsJson || "[]")); } catch { setFields([]); }
    setCollapsedSections({});
    setFormViewMode("builder");
  };

  const handleCreateNewForm = async (empty: any = false) => {
    const name = newFormName.trim() || `${newFormType.split(":")[0]} Form ${backendForms.length + 1}`;
    const description = newFormDesc.trim() || `Configured ${newFormType} change workflow form`;
    const sections = empty ? [] : ["General information"];
    const fieldsList = empty ? [] : [{ l: "Title", t: "Single line text", req: true, sap: false, sec: "General information" }];
    const payload = {
      name,
      type: newFormType,
      description,
      sectionsJson: JSON.stringify(sections),
      fieldsJson: JSON.stringify(fieldsList),
      updatedAt: "Just now",
    };
    const result = await createFormMutation(payload);
    // The create-record response wraps the new record under response.id or response.response.id
    const newId: string =
      (result as any)?.response?.id ??
      (result as any)?.id ??
      `form-${Date.now()}`;
    setActiveFormId(newId);
    setActiveFormMeta({ name, description });
    setSelectedFormType(newFormType);
    setFormSections(sections);
    setFields(fieldsList);
    setCollapsedSections({});
    setFormViewMode("builder");
    setNewFormModal(false);
    setNewFormName("");
    setNewFormDesc("");
  };

  const saveCurrentForm = async () => {
    if (!activeFormId) return;
    // Use locally-tracked meta so we never depend on backendForms being up-to-date
    // (backendForms may not yet contain a freshly-created form before the refetch lands).
    const meta = activeFormMeta ?? backendForms.find((f: any) => f.id === activeFormId);
    if (!meta) return;
    await updateFormMutation(activeFormId, {
      name: meta.name,
      type: selectedFormType,
      description: meta.description,
      sectionsJson: JSON.stringify(formSections),
      fieldsJson: JSON.stringify(fields),
      updatedAt: "Just now",
    });
    toast.success("Form saved");
  };

  const toggleSectionCollapse = (sec: string) => {
    setCollapsedSections((prev: any) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const loadDefaultFormTemplate = () => {
    setFormSections(["Basic details", "Confirmations", "Document control"]);
    setFields([
      { l: "Category", t: "Picklist", req: true, sap: false, sec: "Basic details" },
      { l: "Title", t: "Single line text", req: true, sap: false, sec: "Basic details" },
      { l: "Description", t: "Long text", req: true, sap: false, sec: "Basic details" },
      { l: "Routing", t: "Picklist", req: true, sap: false, sec: "Basic details" },
      { l: "Are validations complete?", t: "Picklist", req: false, sap: false, sec: "Confirmations", opts: ["N/A", "Yes", "No"] },
      { l: "Has seed stock been approved?", t: "Picklist", req: false, sap: false, sec: "Confirmations", opts: ["N/A", "Yes", "No"] },
      { l: "Inventory disposition filled?", t: "Picklist", req: true, sap: true, sec: "Confirmations", opts: ["Yes", "No"] },
      { l: "CCB date", t: "Date", req: false, sap: false, sec: "Document control" },
      { l: "DC rep", t: "Person", req: true, sap: false, sec: "Document control" },
    ]);
  };
  const [fieldModal, setFieldModal] = useState<any>(null);
  const move = (k: any, d: any) => {
    const n = [...fields], j = k + d;
    if (j < 0 || j >= n.length) return;
    [n[k], n[j]] = [n[j], n[k]]; setFields(n);
  };
  const moveFieldInSection = (secName: string, fieldIdxInSec: number, dir: number) => {
    const secFields = fields.map((f: any, idx: any) => ({ ...f, origIdx: idx })).filter((f: any) => f.sec === secName);
    const targetIdx = fieldIdxInSec + dir;
    if (targetIdx < 0 || targetIdx >= secFields.length) return;
    const origA = secFields[fieldIdxInSec].origIdx;
    const origB = secFields[targetIdx].origIdx;
    const n = [...fields];
    [n[origA], n[origB]] = [n[origB], n[origA]];
    setFields(n);
  };

  const userRows = backendUsers.filter((u: any) => (useg === "All" || u.type === useg) &&
    (u.name + u.group + u.email).toLowerCase().includes(uq.toLowerCase()));
  const roleRows = backendRoles.filter((r: any) => (r.name + r.site + r.division).toLowerCase().includes(rq.toLowerCase()));
  const routeRows = backendRoutings.filter((r: any) => r.name.toLowerCase().includes(tq.toLowerCase()));

  return (
    <div className="stack" data-test-id="admin-page">
      <div className="bet">
        <div>
          <div className="crumb">Admin / {tab === "Users" ? "Users" : tab === "Roles" ? "Roles" : tab === "Routings" ? "Routings" : "Form Builder"}</div>
          <h1>{tab === "Users" ? "Users" : tab === "Roles" ? "Roles" : tab === "Routings" ? "Routings" : "Form Builder"}</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            {tab === "Users" && "Manage organization members, partner access, and platform permissions"}
            {tab === "Roles" && "Define cross-functional approval roles and assign responsible reviewers"}
            {tab === "Routings" && "Configure stage-gate change approval workflows and sign-off policies"}
            {tab === "Form Builder" && "Customize change order input fields, validation rules, and sections"}
          </div>
        </div>
        <div className="row">
          {renderHeaderActions?.()}
        </div>
      </div>

      {(tab === "Users" || tab === "Users and roles") && (<>
        <Toolbar q={uq} setQ={setUq} placeholder="Name, group or email"
            segs={["All", "Employee", "Partner"]} seg={useg} setSeg={setUseg}
            count={(x: any) => (x === "All" ? backendUsers.length : backendUsers.filter((u: any) => u.type === x).length)}
            right={<>
              <button className="btn" onClick={() => setInvite(true)}><Upload size={13} />Bulk invite</button>
              <button className="btn pri" onClick={() => setUserModal({ name: "", email: "", group: GROUPS[0], site: "Livermore", access: "Standard user", type: "Employee", active: true, isNew: true })}>
                <Plus size={13} />Add user</button>
            </>} />
        <Card pad={false}>
          <div className="scrollx" style={{ overflowX: "auto", minWidth: 0 }}>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Email</th><th>Group</th><th>Site</th><th>Access level</th><th>Type</th><th>Status</th><th style={{ width: 44, textAlign: "right" }}></th></tr></thead>
              <tbody>
                {usersLoading && <tr><td colSpan={8}><div className="sub" style={{ padding: "20px 16px" }}>Loading users…</div></td></tr>}
                {!usersLoading && userRows.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE).map((u: any) => (
                  <tr key={u.id}>
                    <td><div className="row" style={{ gap: 9 }}>
                      <span className="ava2">{u.name.split(" ").map((x: any) => x[0]).join("").slice(0, 2)}</span>
                      <b style={{ fontWeight: 600 }}>{u.name}</b></div></td>
                    <td className="sub">{u.email}</td>
                    <td className="sub">{u.group}</td><td className="sub">{u.site}</td>
                    <td><Chip k={u.access === "Administrator" ? "blue" : u.access === "View only" ? "gray" : "slate"}>{u.access}</Chip></td>
                    <td><Chip k={u.type === "Partner" ? "slate" : "gray"}>{u.type}</Chip></td>
                    <td>{!u.active ? <Chip k="bad">Disabled</Chip> : <Chip k="ok">Active</Chip>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn sm" title="Edit" onClick={() => setUserModal({ ...u })} style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, padding: 0, border: "none" }}><Pencil size={13} /></button>
                    </td>
                  </tr>
                ))}
                {!usersLoading && !userRows.length && <tr><td colSpan={8}><Empty icon={Users} title="No users match that search"
                  body="Try a different name, group or email." /></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination total={userRows.length} page={userPage} setPage={setUserPage} />
        </Card>
      </>)}

      {(tab === "Roles" || tab === "Approval roles") && (<>
        <Toolbar q={rq} setQ={setRq} placeholder="Search approval roles"
            right={<button className="btn pri" data-test-id="new-role-btn" onClick={() => setRoleModal({ name: "", division: "Both", site: "All sites", membersJson: "[]", isNew: true })}>
              <Plus size={13} />New approval role</button>} />
        <Card pad={false}>
          <div className="scrollx" style={{ overflowX: "auto", minWidth: 0 }}>
            <table className="tbl">
              <thead><tr><th>Approval role</th><th>Division</th><th>Site</th><th>Members</th><th>Used in routings</th><th style={{ width: 44, textAlign: "right" }}></th></tr></thead>
              <tbody>
                {rolesLoading && <tr><td colSpan={6}><div className="sub" style={{ padding: "20px 16px" }}>Loading roles…</div></td></tr>}
                {!rolesLoading && roleRows.slice(rolePage * PAGE_SIZE, (rolePage + 1) * PAGE_SIZE).map((r: any) => {
                  const memberIds: string[] = (() => { try { return JSON.parse(r.membersJson || "[]"); } catch { return []; } })();
                  const memberNames = memberIds.map((id: any) => backendUsers.find((u: any) => u.id === id)?.name ?? id);
                  const usedCount = backendRoutings.filter((t: any) => { try { return JSON.parse(t.stagesJson || "[]").some((st: any) => st.g === r.name); } catch { return false; } }).length;
                  return (
                    <tr key={r.id} data-test-id={`role-row-${r.id}`}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td><Chip k={r.division === "AG" ? "slate" : r.division === "CO" ? "blue" : "gray"}>{r.division}</Chip></td>
                      <td className="sub">{r.site}</td>
                      <td><div className="row" style={{ gap: 5 }}>
                        {memberNames.slice(0, 3).map((m: any) => <span key={m} className="ava2 sm" title={m}>{m.split(" ").map((x: any) => x[0]).join("").slice(0, 2)}</span>)}
                        {memberNames.length > 3 && <span className="mini">+{memberNames.length - 3}</span>}
                        {!memberNames.length && <span className="mut">No members</span>}
                      </div></td>
                      <td className="sub">{usedCount}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn sm" title="Edit" data-test-id={`edit-role-btn-${r.id}`} onClick={() => setRoleModal({ ...r, isNew: false })} style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, padding: 0, border: "none" }}><Pencil size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
                {!rolesLoading && !roleRows.length && <tr><td colSpan={6}><Empty icon={ShieldCheck} title="No approval roles match"
                  body="An approval role is a named group of people a routing can call on." /></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination total={roleRows.length} page={rolePage} setPage={setRolePage} />
        </Card>
      </>)}

      {tab === "Routings" && (<>
        <Toolbar q={tq} setQ={setTq} placeholder="Search routings"
            right={<button className="btn pri" onClick={() => setRouteModal({ name: "", division: "CO", used: 0, stagesJson: "[]", formId: "form-eco", isNew: true })}>
              <Plus size={13} />New routing</button>} />
        <Card pad={false}>
          <div className="scrollx" style={{ overflowX: "auto", minWidth: 0 }}>
            <table className="tbl">
              <thead><tr><th>Routing</th><th>Division</th><th>Stage 1 roles</th><th>Stage 2 roles</th><th>Changes routed</th><th style={{ width: 44, textAlign: "right" }}></th></tr></thead>
              <tbody>
                {routingsLoading && <tr><td colSpan={6}><div className="sub" style={{ padding: "20px 16px" }}>Loading routings…</div></td></tr>}
                {!routingsLoading && routeRows.slice(routePage * PAGE_SIZE, (routePage + 1) * PAGE_SIZE).map((r: any) => {
                  let stages: any[] = [];
                  try { stages = JSON.parse(r.stagesJson || "[]"); } catch { stages = []; }
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.name}</td>
                      <td><Chip k={r.division === "AG" ? "slate" : "blue"}>{r.division}</Chip></td>
                      <td>{stages.filter((x: any) => x.stage === 1).length}</td>
                      <td>{stages.filter((x: any) => x.stage === 2).length || <span className="mut">—</span>}</td>
                      <td className="sub">{r.used}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button className="btn sm" title="Edit" onClick={() => setRouteModal({ ...r })} style={{ display: "inline-grid", placeItems: "center", width: 28, height: 28, padding: 0, border: "none" }}><Pencil size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
                {!routingsLoading && !routeRows.length && <tr><td colSpan={6}><Empty icon={Layers} title="No routings found" body="Create a routing to define an approval flow." /></td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination total={routeRows.length} page={routePage} setPage={setRoutePage} />
        </Card>
      </>)}

      {(tab === "Form Builder" || tab === "Change form builder") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} data-test-id="form-builder-container">
          {/* FLOW 1: If no form is currently opened, display the List of all created forms & Create New Form action */}
          {!activeFormId ? (<>
            <Toolbar
                  q={formSearchQuery}
                  setQ={setFormSearchQuery}
                  placeholder="Search forms by name or type"
                  right={
                    <button
                      type="button"
                      className="btn pri"
                      data-test-id="create-new-form-btn"
                      onClick={() => {
                        setNewFormName("");
                        setNewFormDesc("");
                        setNewFormType("ECO: Engineering Change Order");
                        setNewFormModal(true);
                      }}
                    >
                      <Plus size={13} />
                      Create new form
                    </button>
                  }
                />
            <Card pad={false}>
                <div className="scrollx" style={{ overflowX: "auto", minWidth: 0 }}>
                  <table className="tbl" data-test-id="forms-list-table">
                    <thead>
                      <tr>
                        <th>Form name</th>
                        <th>Type</th>
                        <th>In use</th>
                        <th>Sections</th>
                        <th>Fields</th>
                        <th>Last updated</th>
                        <th style={{ width: 100, textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        if (formsLoading) return (
                          <tr><td colSpan={7}><div className="sub" style={{ padding: "20px 16px" }}>Loading forms…</div></td></tr>
                        );
                        const filtered = backendForms.filter((f: any) => (f.name + f.type + f.description).toLowerCase().includes(formSearchQuery.toLowerCase()));
                        const paged = filtered.slice(formPage * PAGE_SIZE, (formPage + 1) * PAGE_SIZE);
                        if (paged.length === 0) return (
                          <tr>
                            <td colSpan={7} style={{ textAlign: "center", padding: "40px 20px" }}>
                              <p style={{ color: "#627D98", fontSize: 13, marginBottom: 12 }}>No forms found matching your query.</p>
                              <button type="button" className="btn pri" onClick={() => { setNewFormName(""); setNewFormDesc(""); setNewFormModal(true); }}>
                                <Plus size={13} /> Create new form
                              </button>
                            </td>
                          </tr>
                        );
                        return paged.map((f: any) => {
                          const sections = (() => { try { return JSON.parse(f.sectionsJson || "[]"); } catch { return []; } })();
                          const ffields = (() => { try { return JSON.parse(f.fieldsJson || "[]"); } catch { return []; } })();
                          const inUseCount = backendRoutings.filter((r: any) => r.formId === f.id).length;
                          return (
                            <tr key={f.id} data-test-id={`form-row-${f.id}`}>
                              <td>
                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                  <b style={{ fontWeight: 600, color: "#0A2233", fontSize: 13 }}>{f.name}</b>
                                  <span className="mini" style={{ color: "#627D98" }}>{f.description}</span>
                                </div>
                              </td>
                              <td>
                                <Chip k={f.type.startsWith("ECO") ? "blue" : f.type === "DCO" ? "slate" : "gray"}>
                                  {f.type.split(":")[0]}
                                </Chip>
                              </td>
                              <td>
                                {inUseCount > 0
                                  ? <Chip k="ok">{inUseCount} routing{inUseCount !== 1 ? "s" : ""}</Chip>
                                  : <span className="mut">Not assigned</span>}
                              </td>
                              <td><span style={{ fontSize: 13, color: "#0A2233", fontWeight: 500 }}>{sections.length} {sections.length === 1 ? "section" : "sections"}</span></td>
                              <td><span style={{ fontSize: 13, color: "#0A2233", fontWeight: 500 }}>{ffields.length} {ffields.length === 1 ? "field" : "fields"}</span></td>
                              <td className="sub">{f.updatedAt}</td>
                              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                                  <button type="button" className="btn sm" data-test-id={`edit-form-btn-${f.id}`} onClick={() => openFormEditor(f)}>
                                    <Sliders size={12} />Edit
                                  </button>
                                  <button type="button" className="btn gh sm" title="Delete form" style={{ color: T.bad }}
                                    onClick={async () => {
                                      if (backendForms.length <= 1) { alert("At least one form must remain."); return; }
                                      await deleteFormMutation(f.id);
                                    }}>
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  total={backendForms.filter((f: any) => (f.name + f.type + f.description).toLowerCase().includes(formSearchQuery.toLowerCase())).length}
                  page={formPage}
                  setPage={setFormPage}
                />
            </Card>
          </>) : (
            /* FLOW 2: Form Canvas & Live Preview for the selected/active form */
            <>
              {/* Back to all forms navigation banner */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 16px" }}>
                <div className="row" style={{ gap: 10 }}>
                  <button
                    type="button"
                    className="btn sm"
                    data-test-id="back-to-forms-btn"
                    onClick={async () => {
                      await saveCurrentForm();
                      setActiveFormId(null);
                      setActiveFormMeta(null);
                    }}
                  >
                    <ArrowLeft size={13} />
                    All forms
                  </button>
                  <div style={{ height: 18, width: 1, background: "#E2E8F0" }} />
                  <div className="row" style={{ gap: 8 }}>
                    <b style={{ color: "#0A2233", fontSize: 14 }}>
                      {activeFormMeta?.name || backendForms.find((f: any) => f.id === activeFormId)?.name || "Form Customizer"}
                    </b>
                    <Chip k="blue">{selectedFormType.split(":")[0]}</Chip>
                  </div>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={async () => {
                      await saveCurrentForm();
                      setActiveFormId(null);
                      setActiveFormMeta(null);
                    }}
                  >
                    Done &amp; save
                  </button>
                </div>
              </div>

              {/* Builder Canvas View */}
              <div className="fb-canvas" data-test-id="form-builder-canvas">
                  {/* Canvas Header / Controls integrated directly inside the main card */}
                  <div style={{
                    background: "#FFFFFF",
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 1px 3px rgba(2,42,66,.05)",
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 12
                  }}>
                    <div className="row" style={{ gap: 12 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="mini" style={{ fontWeight: 600, color: "#627D98", textTransform: "uppercase", letterSpacing: "0.04em" }}>Type:</span>
                        <Select
                          value={selectedFormType}
                          options={["ECO: Engineering Change Order", "DCO", "TPCO", "RFD"]}
                          onChange={(e: any) => setSelectedFormType(e.target.value)}
                          style={{ width: 230, height: 32 }}
                        />
                      </div>
                      {formSections.length > 0 && (
                        <div className="row" style={{ gap: 6 }}>
                          <Chip k="blue">{formSections.length} sections</Chip>
                          <Chip k="gray">{fields.length} fields</Chip>
                        </div>
                      )}
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn pri"
                        data-test-id="add-section-btn"
                        onClick={() => setSectionModal({ name: "", isNew: true })}
                      >
                        <Plus size={13} />
                        {formSections.length > 0 ? "Add section" : "Add first section"}
                      </button>
                    </div>
                  </div>

                  {/* Default empty / zero state when nothing has been added yet */}
                  {formSections.length === 0 ? (
                    <div className="fb-zero-state" data-test-id="form-builder-empty-state">
                      <div style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        background: "#E6F2FB",
                        color: T.brand,
                        display: "grid",
                        placeItems: "center",
                        marginBottom: 16
                      }}>
                        <Layers size={26} />
                      </div>
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0A2233", marginBottom: 6 }}>No form sections yet</h3>
                      <p style={{ fontSize: 13, color: "#627D98", maxWidth: 460, margin: "0 auto 20px", lineHeight: 1.5 }}>
                        Get started by creating your first form section on this canvas. Once a section exists, you can organize custom fields and validation rules inside it.
                      </p>
                      <div className="row" style={{ gap: 10 }}>
                        <button
                          type="button"
                          className="btn pri"
                          data-test-id="empty-add-section-btn"
                          onClick={() => setSectionModal({ name: "", isNew: true })}
                        >
                          <Plus size={14} /> Add section
                        </button>
                        <button
                          type="button"
                          className="btn"
                          data-test-id="load-default-template-btn"
                          style={{ background: "#FFFFFF", color: "#486581" }}
                          onClick={loadDefaultFormTemplate}
                        >
                          Load standard template
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Sections List with collapse/expand */
                    formSections.map((sec: any, secIdx: any) => {
                      const secFields = fields.filter((f: any) => f.sec === sec);
                      const isCollapsed = !!collapsedSections[sec];
                      return (
                        <div key={sec} className="fb-section-card" data-test-id={`canvas-section-${sec.toLowerCase().replace(/\s+/g, "-")}`}>
                          <div
                            className="fb-section-header"
                            onClick={() => toggleSectionCollapse(sec)}
                            title="Click to collapse / expand section"
                          >
                            <div className="row" style={{ gap: 10 }}>
                              <span style={{ color: "#7993A8", display: "grid", placeItems: "center" }}>
                                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                              </span>
                              <div style={{
                                width: 24,
                                height: 24,
                                borderRadius: 6,
                                background: "#E6F2FB",
                                color: T.brand,
                                fontWeight: 700,
                                fontSize: 12,
                                display: "grid",
                                placeItems: "center"
                              }}>
                                {secIdx + 1}
                              </div>
                              <div>
                                <b style={{ fontSize: 13, color: "#0A2233" }}>{sec}</b>
                                <span className="mini" style={{ marginLeft: 8, color: "#7993A8" }}>
                                  {secFields.length} {secFields.length === 1 ? "field" : "fields"}
                                  {isCollapsed && " (collapsed)"}
                                </span>
                              </div>
                            </div>

                            <div className="row" style={{ gap: 6 }} onClick={(e: any) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="btn gh sm"
                                title="Rename section"
                                onClick={() => setSectionModal({ name: sec, isNew: false, oldName: sec })}
                              >
                                <Pencil size={12} />
                                Rename
                              </button>
                              <button
                                type="button"
                                className="btn gh sm"
                                title="Add field to this section"
                                onClick={() => setFieldModal({
                                  l: "",
                                  t: "Single line text",
                                  req: false,
                                  sap: false,
                                  sec: sec,
                                  opts: [],
                                  isNew: true
                                })}
                              >
                                <Plus size={12} />
                                Add field
                              </button>
                              <button
                                type="button"
                                className="btn gh sm"
                                title="Delete section"
                                style={{ color: T.bad }}
                                onClick={() => {
                                  setFormSections(formSections.filter((_: any, i: any) => i !== secIdx));
                                  setFields(fields.filter((f: any) => f.sec !== sec));
                                }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>

                          {!isCollapsed && (
                            <div className="fb-section-body">
                              {secFields.length === 0 ? (
                                <div className="fb-empty-section">
                                  No fields in this section yet. Click <b>Add field</b> to place input fields here.
                                </div>
                              ) : (
                                secFields.map((f: any, fieldIdxInSec: any) => {
                                  const globalIdx = fields.findIndex((gf: any) => gf === f);
                                  return (
                                    <div key={f.l + fieldIdxInSec} className="fb-field-card" data-test-id={`canvas-field-${f.l.toLowerCase().replace(/\s+/g, "-")}`}>
                                      <div className="handle">
                                        <button
                                          type="button"
                                          disabled={fieldIdxInSec === 0}
                                          onClick={() => moveFieldInSection(sec, fieldIdxInSec, -1)}
                                          title="Move up"
                                        >
                                          <ChevronUp size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={fieldIdxInSec === secFields.length - 1}
                                          onClick={() => moveFieldInSection(sec, fieldIdxInSec, 1)}
                                          title="Move down"
                                        >
                                          <ChevronDown size={12} />
                                        </button>
                                      </div>

                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                          <b style={{ fontWeight: 600, color: "#0A2233", fontSize: 13 }}>{f.l}</b>
                                          {f.req && <Chip k="bad">Required</Chip>}
                                          {f.sap && <Chip k="blue" icon={Database}>SAP sync</Chip>}
                                          {f.t === "Picklist" && f.opts && <Chip k="gray">{f.opts.length} choices</Chip>}
                                        </div>
                                        <div className="mini" style={{ marginTop: 2, color: "#627D98" }}>
                                          Field type: <span style={{ fontWeight: 600, color: "#486581" }}>{f.t}</span>
                                        </div>
                                      </div>

                                      <div className="row" style={{ gap: 4 }}>
                                        <button
                                          type="button"
                                          className="btn gh sm"
                                          title="Edit field"
                                          onClick={() => setFieldModal({ ...f, idx: globalIdx })}
                                        >
                                          <Pencil size={12} />
                                        </button>
                                        <button
                                          type="button"
                                          className="btn gh sm"
                                          title="Remove field"
                                          onClick={() => setFields(fields.filter((_: any, j: any) => j !== globalIdx))}
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  {formSections.length > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ background: "#FFFFFF", border: "1px dashed #B3D7F7", color: T.brand, padding: "8px 18px", height: "auto" }}
                        onClick={() => setSectionModal({ name: "", isNew: true })}
                      >
                        <Plus size={14} /> Add new section to canvas
                      </button>
                    </div>
                  )}
                </div>
            </>
          )}
        </div>
      )}

      {/* ---------- user editor ---------- */}
      {userModal && (() => {
        const deriveDivision = (group: string) =>
          group.startsWith("AG") ? "AG" : group.startsWith("Construction") ? "CO" : "Both";

        const handleSave = async () => {
          const { isNew, id, ...rest } = userModal;
          const payload = { ...rest, division: deriveDivision(rest.group), active: rest.active !== false };
          setUserSaving(true);
          try {
            if (isNew) {
              await createUser(payload);
              toast.success(`Invitation sent to ${payload.name || payload.email}`);
            } else {
              await updateUser(id, payload);
              toast.success(`${payload.name} updated`);
            }
            setUserModal(null);
          } catch (err) {
            toast.error(isNew ? "Failed to create user — please try again" : "Failed to save changes — please try again");
          } finally {
            setUserSaving(false);
          }
        };

        const handleToggleActive = async () => {
          const { isNew, id, ...rest } = userModal;
          const payload = { ...rest, division: deriveDivision(rest.group), active: !rest.active };
          setUserSaving(true);
          try {
            await updateUser(id, payload);
            toast.success(`${rest.name} ${payload.active ? "re-enabled" : "disabled"}`);
            setUserModal(null);
          } catch (err) {
            toast.error("Failed to update account status");
          } finally {
            setUserSaving(false);
          }
        };

        return (
          <Modal title={userModal.isNew ? "Add user" : `Edit ${userModal.name}`} onClose={() => !userSaving && setUserModal(null)}
            foot={<>
              {!userModal.isNew && (
                <button className="btn dan" disabled={userSaving} data-test-id="toggle-user-active-btn" onClick={handleToggleActive}>
                  {!userModal.active ? "Re-enable account" : "Disable account"}
                </button>
              )}
              <button className="btn" style={{ marginLeft: "auto" }} disabled={userSaving} onClick={() => setUserModal(null)}>Cancel</button>
              <button className="btn pri" data-test-id="save-user-btn"
                disabled={userSaving || !userModal.name || !userModal.email}
                onClick={handleSave}>
                {userSaving ? <Loader2 size={13} className="spin" /> : <Check size={13} />}
                {userModal.isNew ? "Send invitation" : "Save changes"}
              </button>
            </>}>
            <div className="grid2">
              <Field label="Full name"><Input value={userModal.name} autoFocus
                onChange={(e: any) => setUserModal({ ...userModal, name: e.target.value })} /></Field>
              <Field label="Work email"><Input value={userModal.email} placeholder="name@topcon.com"
                onChange={(e: any) => setUserModal({ ...userModal, email: e.target.value })} /></Field>
              <Field label="Group"><Select value={userModal.group} onChange={(e: any) => setUserModal({ ...userModal, group: e.target.value })}
                options={GROUPS} /></Field>
              <Field label="Site"><Select value={userModal.site} onChange={(e: any) => setUserModal({ ...userModal, site: e.target.value })}
                options={["Livermore", "Fort Collins", "Adelaide", "Sask", "Tokyo", "Ahmedabad"]} /></Field>
            </div>
            <div style={{ height: 14 }} />
            <Field label="Access level">
              <div className="optcards">
                {[["Administrator", "Manage users, roles, routings, form fields and integrations"],
                  ["Standard user", "Create and approve changes, edit items they own"],
                  ["View only", "Read everything, change nothing"]].map(([l, d]: any) => (
                  <button key={l} className={`optcard ${userModal.access === l ? "on" : ""}`}
                    onClick={() => setUserModal({ ...userModal, access: l })}>
                    <div className="row" style={{ gap: 8 }}>
                      <span className={`radio ${userModal.access === l ? "on" : ""}`} />
                      <b>{l}</b>
                    </div>
                    <div className="mini" style={{ marginTop: 4, paddingLeft: 24 }}>{d}</div>
                  </button>
                ))}
              </div>
            </Field>
            <div style={{ height: 14 }} />
            <Field label="User type" hint="Partners are contract engineering staff with the same item access as employees.">
              <Select value={userModal.type} onChange={(e: any) => setUserModal({ ...userModal, type: e.target.value })}
                options={["Employee", "Partner", "Supplier"]} />
            </Field>
          </Modal>
        );
      })()}

      {/* ---------- bulk invite: CSV only ---------- */}
      {invite && (
        <Modal title="Import users from CSV" wide onClose={() => setInvite(false)}
          foot={<button className="btn" style={{ marginLeft: "auto" }} onClick={() => setInvite(false)}>Close</button>}>
          <CsvImport
            templateName="topcon-user-import-template.csv"
            template={"Email,Full name,Group,Site,Access level,User type\n" +
              "priya.raman@topcon.com,Priya Raman,Quality Assurance (QA),Livermore,Standard user,Employee\n" +
              "carol.nosworthy@eiinfochips.com,Carol Nosworthy,Construction Engineering,Livermore,View only,Partner"}
            columns={["Email", "Full name", "Group", "Site", "Access level", "User type"]}
            rows={[
              { a: "priya.raman@topcon.com", b: "Priya Raman", c: "Quality Assurance (QA)", d: "Livermore", e: "Standard user", f: "Employee", sev: "ok", rule: "Ready", msg: "New account, group and site recognised" },
              { a: "rahul.desai@topcon.com", b: "Rahul Desai", c: "Materials", d: "Livermore", e: "Standard user", f: "Employee", sev: "ok", rule: "Ready", msg: "New account, group and site recognised" },
              { a: "carol.nosworthy@eiinfochips.com", b: "Carol Nosworthy", c: "Construction Engineering", d: "Livermore", e: "View only", f: "Partner", sev: "warn", rule: "External domain", msg: "eiinfochips.com is not a Topcon domain — will be created as a partner account" },
              { a: "steve.howe@topcon.com", b: "Steve Howe", c: "PLM", d: "Livermore", e: "Standard user", f: "Employee", sev: "warn", rule: "Already exists", msg: "Account already active — this row will update the group and site, not create a duplicate" },
              { a: "j.tanaka@topcon", b: "Jun Tanaka", c: "Sales", d: "Tokyo", e: "Standard user", f: "Employee", sev: "err", rule: "Invalid email", msg: "j.tanaka@topcon is not a valid address" },
              { a: "m.silva@topcon.com", b: "Marco Silva", c: "Hydrographics", d: "Lisbon", e: "Standard user", f: "Employee", sev: "err", rule: "Unknown group", msg: "No group called “Hydrographics” exists — create it first or correct the row" },
            ]}
            entity="invitations"
            verb="Send"
            onDone={(n: any) => setInvite(false)} />
        </Modal>
      )}

      {/* ---------- approval role editor ---------- */}
      {roleModal && (() => {
        const memberIds: string[] = (() => { try { return JSON.parse(roleModal.membersJson || "[]"); } catch { return []; } })();
        return (
          <Modal title={roleModal.isNew ? "New approval role" : `Edit ${roleModal.name}`} onClose={() => setRoleModal(null)}
            foot={<>
              {!roleModal.isNew && <button className="btn dan" data-test-id="delete-role-btn" onClick={async () => {
                await deleteRole(roleModal.id); setRoleModal(null);
              }}><Trash2 size={13} />Delete role</button>}
              <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setRoleModal(null)}>Cancel</button>
              <button className="btn pri" data-test-id="save-role-btn" disabled={!roleModal.name} onClick={async () => {
                const payload = { name: roleModal.name, division: roleModal.division, site: roleModal.site, membersJson: roleModal.membersJson };
                if (roleModal.isNew) { await createRole(payload); }
                else { await updateRole(roleModal.id, payload); }
                setRoleModal(null);
              }}><Check size={13} />{roleModal.isNew ? "Create role" : "Save changes"}</button>
            </>}>
            <div className="grid2">
              <Field label="Role name" hint="Shown to approvers on every change that uses it">
                <Input value={roleModal.name} autoFocus placeholder="Construction Engineering"
                  onChange={(e: any) => setRoleModal({ ...roleModal, name: e.target.value })} /></Field>
              <Field label="Division"><Select value={roleModal.division} onChange={(e: any) => setRoleModal({ ...roleModal, division: e.target.value })}
                options={["Both", "CO", "AG"]} /></Field>
            </div>
            <div style={{ height: 14 }} />
            <Field label="Site"><Select value={roleModal.site} onChange={(e: any) => setRoleModal({ ...roleModal, site: e.target.value })}
              options={["All sites", "Livermore", "Fort Collins", "Adelaide", "Tokyo", "Sask", "Ahmedabad"]} /></Field>
            <div style={{ height: 16 }} />
            <Field label={`Members (${memberIds.length})`} hint="Anyone here can approve on behalf of this role.">
              <IdMemberPicker
                value={memberIds}
                users={backendUsers}
                onChange={(ids: any) => setRoleModal({ ...roleModal, membersJson: JSON.stringify(ids) })}
              />
            </Field>
          </Modal>
        );
      })()}

      {/* ---------- routing builder: dynamic stages ---------- */}
      {routeModal && (() => {
        // routeModal stores stages as an array internally for editing
        const stagesArr = routeModal._stages ?? (() => {
          try { return JSON.parse(routeModal.stagesJson || "[]"); } catch { return []; }
        })();
        const stages = [...new Set(stagesArr.map((x: any) => x.stage))].sort((a2: any, b2: any) => a2 - b2);
        const list: any[] = stages.length ? stages : [];
        const setStages = (st: any) => setRouteModal({ ...routeModal, _stages: st });
        const addStage = () => setStages([...stagesArr,
          { g: "", req: "One or more", stage: (list[list.length - 1] || 0) + 1, members: [], placeholder: true }]);
        const stageName = (n: any) => routeModal.names?.[n] || (n === 1 ? "Functional approval" : n === 2 ? "Document control sign-off" : `Stage ${n}`);
        return (
          <Modal title={routeModal.isNew ? "New routing" : `Edit ${routeModal.name}`} wide onClose={() => setRouteModal(null)}
            foot={<>
              {!routeModal.isNew && <button className="btn" onClick={async () => {
                const cleanStages = stagesArr.filter((x: any) => !x.placeholder);
                await createRouting({ name: routeModal.name + " (copy)", division: routeModal.division, stagesJson: JSON.stringify(cleanStages), formId: routeModal.formId || "form-eco", used: 0 });
                setRouteModal(null);
              }}>Duplicate</button>}
              <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setRouteModal(null)}>Cancel</button>
              <button className="btn pri" disabled={!routeModal.name || !stagesArr.filter((x: any) => !x.placeholder).length}
                onClick={async () => {
                  const cleanStages = stagesArr.filter((x: any) => !x.placeholder);
                  const payload = { name: routeModal.name, division: routeModal.division, stagesJson: JSON.stringify(cleanStages), formId: routeModal.formId || "form-eco", used: routeModal.used || 0 };
                  if (routeModal.isNew) { await createRouting(payload); }
                  else { await updateRouting(routeModal.id, payload); }
                  setRouteModal(null);
                }}><Check size={13} />{routeModal.isNew ? "Create routing" : "Save changes"}</button>
            </>}>
            <div className="grid2">
              <Field label="Routing name"><Input value={routeModal.name} autoFocus placeholder="ECO Construction"
                onChange={(e: any) => setRouteModal({ ...routeModal, name: e.target.value })} /></Field>
              <Field label="Division"><Select value={routeModal.division} onChange={(e: any) => setRouteModal({ ...routeModal, division: e.target.value })}
                options={["CO", "AG", "Both"]} /></Field>
            </div>

            <div className="bet" style={{ margin: "20px 0 10px" }}>
              <div><b>Approval stages</b>
                <div className="mini" style={{ marginTop: 2 }}>Stages run in order. Everyone inside one stage is asked at the same time;
                  the next stage stays locked until the one before it clears.</div></div>
              <button className="btn sm" onClick={addStage}><Plus size={12} />Add stage</button>
            </div>

            {!list.length && (
              <div className="emptyslot">No stages yet. Add a stage, then add the approval roles that belong to it.</div>
            )}

            {list.map((n: any, idx: any) => {
              const inStage = stagesArr.filter((x: any) => x.stage === n && !x.placeholder);
              return (
                <div key={n} className="stagecard">
                  <div className="stagehead">
                    <span className="stagepill">Stage {idx + 1}</span>
                    <input className="stagename" value={stageName(n)}
                      onChange={(e: any) => setRouteModal({ ...routeModal, names: { ...(routeModal.names || {}), [n]: e.target.value } })} />
                    <span className="mini">{inStage.length} role{inStage.length === 1 ? "" : "s"}</span>
                    <div className="row" style={{ marginLeft: "auto", gap: 6 }}>
                      <Select style={{ width: 200, height: 29 }} value="" options={["Add approval role…", ...backendRoles.map((r: any) => r.name)]}
                        onChange={(e: any) => {
                          const role = backendRoles.find((r: any) => r.name === e.target.value);
                          if (!role) return;
                          const memberIds: string[] = (() => { try { return JSON.parse(role.membersJson || "[]"); } catch { return []; } })();
                          const memberNames = memberIds.map((id: any) => backendUsers.find((u: any) => u.id === id)?.name ?? id);
                          setStages([...stagesArr.filter((x: any) => !(x.stage === n && x.placeholder)),
                            { g: role.name, req: "One or more", stage: n, members: memberNames }]);
                        }} />
                      <button className="btn gh sm" title="Remove stage"
                        onClick={() => setStages(stagesArr.filter((x: any) => x.stage !== n))}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {!inStage.length ? (
                    <div className="emptyslot" style={{ margin: 12 }}>No approval roles in this stage yet.</div>
                  ) : (
                    <table className="tbl">
                      <thead><tr><th>Approval role</th><th style={{ width: 190 }}>Requirement</th><th>Members</th><th style={{ width: 44 }}></th></tr></thead>
                      <tbody>
                        {stagesArr.map((x: any, k: any) => x.stage === n && !x.placeholder && (
                          <tr key={x.g + k}>
                            <td style={{ fontWeight: 600 }}>{x.g}</td>
                            <td><Select value={x.req} style={{ height: 28 }}
                              options={["One or more", "All members", "Optional", "Comments only"]}
                              onChange={(e: any) => { const c = [...stagesArr]; c[k] = { ...x, req: e.target.value }; setStages(c); }} /></td>
                            <td className="sub">{(x.members || []).join(", ") || "No members"}</td>
                            <td style={{ textAlign: "right" }}>
                              <button className="btn gh sm" onClick={() => {
                                const remainingInStage = stagesArr.filter((_: any, j: any) => j !== k && _.stage === n && !_.placeholder);
                                if (remainingInStage.length === 0) {
                                  setStages([...stagesArr.filter((_: any, j: any) => j !== k), { g: "", req: "One or more", stage: n, members: [], placeholder: true }]);
                                } else {
                                  setStages(stagesArr.filter((_: any, j: any) => j !== k));
                                }
                              }}>
                                <Trash2 size={12} /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </Modal>
        );
      })()}

      {/* ---------- field editor ---------- */}
      {fieldModal && (
        <Modal title={fieldModal.isNew ? "Add field" : `Edit “${fieldModal.l}”`} onClose={() => setFieldModal(null)}
          foot={<>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setFieldModal(null)}>Cancel</button>
            <button className="btn pri" disabled={!fieldModal.l} onClick={() => {
              setFields(fieldModal.isNew ? [...fields, { ...fieldModal, isNew: undefined }]
                : fields.map((f: any, k: any) => k === fieldModal.idx ? { ...fieldModal, idx: undefined } : f));
              setFieldModal(null);
            }}><Check size={13} />{fieldModal.isNew ? "Add field" : "Save field"}</button>
          </>}>
          <Field label="Label" hint="What the person filling in the change order will read">
            <Input value={fieldModal.l} autoFocus placeholder="Seed stock disposition"
              onChange={(e: any) => setFieldModal({ ...fieldModal, l: e.target.value })} /></Field>
          <div style={{ height: 14 }} />
          <div className="grid2">
            <Field label="Field type"><Select value={fieldModal.t} options={FIELD_TYPES}
              onChange={(e: any) => setFieldModal({ ...fieldModal, t: e.target.value })} /></Field>
            <Field label="Section"><Select value={fieldModal.sec} options={formSections.length ? formSections : ["Basic details"]}
              onChange={(e: any) => setFieldModal({ ...fieldModal, sec: e.target.value })} /></Field>
          </div>
          {fieldModal.t === "Picklist" && (<>
            <div style={{ height: 14 }} />
            <Field label={`Options (${(fieldModal.opts || []).length})`} hint="These are the choices the person picks from.">
              <div className="optlist">
                {(fieldModal.opts || []).map((o: any, k: any) => (
                  <div key={k} className="optrow">
                    <span className="ordinal">{k + 1}</span>
                    <input className="inp" value={o} placeholder="Option label" onChange={(e: any) => {
                      const n = [...fieldModal.opts]; n[k] = e.target.value; setFieldModal({ ...fieldModal, opts: n });
                    }} />
                    <button className="btn gh sm" title="Remove"
                      onClick={() => setFieldModal({ ...fieldModal, opts: fieldModal.opts.filter((_: any, j: any) => j !== k) })}>
                      <Trash2 size={12} /></button>
                  </div>
                ))}
                {!(fieldModal.opts || []).length && <div className="emptyslot">No options yet — add the first one.</div>}
                <button className="btn sm" style={{ alignSelf: "flex-start", marginTop: 2 }}
                  onClick={() => setFieldModal({ ...fieldModal, opts: [...(fieldModal.opts || []), ""] })}>
                  <Plus size={12} />Add option</button>
              </div>
            </Field>
          </>)}
          <div style={{ height: 16 }} />
          <div className="togglerow">
            <div><b>Required</b><div className="mini">The change cannot be submitted until this is filled in</div></div>
            <input type="checkbox" checked={fieldModal.req} onChange={(e: any) => setFieldModal({ ...fieldModal, req: e.target.checked })} />
          </div>
          <div className="togglerow">
            <div><b>Send to SAP</b><div className="mini">Include this value in the payload written at the effective stage</div></div>
            <input type="checkbox" checked={fieldModal.sap} onChange={(e: any) => setFieldModal({ ...fieldModal, sap: e.target.checked })} />
          </div>
        </Modal>
      )}

      {/* ---------- section editor modal ---------- */}
      {sectionModal && (
        <Modal
          title={sectionModal.isNew ? "Add section" : "Rename section"}
          onClose={() => setSectionModal(null)}
          foot={<>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setSectionModal(null)}>Cancel</button>
            <button
              className="btn pri"
              disabled={!sectionModal.name.trim()}
              onClick={() => {
                const trimmed = sectionModal.name.trim();
                if (!trimmed) return;
                if (sectionModal.isNew) {
                  if (!formSections.includes(trimmed)) {
                    setFormSections([...formSections, trimmed]);
                  }
                } else if (sectionModal.oldName && sectionModal.oldName !== trimmed) {
                  setFormSections(formSections.map((s: any) => s === sectionModal.oldName ? trimmed : s));
                  setFields(fields.map((f: any) => f.sec === sectionModal.oldName ? { ...f, sec: trimmed } : f));
                }
                setSectionModal(null);
              }}
            >
              <Check size={13} />{sectionModal.isNew ? "Add section" : "Save section"}
            </button>
          </>}
        >
          <Field label="Section name" hint="Organize fields into logical collapsible or titled groups">
            <Input
              value={sectionModal.name}
              autoFocus
              placeholder="e.g. Compliance & Approvals"
              onChange={(e: any) => setSectionModal({ ...sectionModal, name: e.target.value })}
            />
          </Field>
        </Modal>
      )}

      {/* ---------- new form creation modal ---------- */}
      {newFormModal && (
        <Modal
          title="Create new change form"
          onClose={() => setNewFormModal(false)}
          foot={<>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setNewFormModal(false)}>Cancel</button>
            <button
              className="btn pri"
              data-test-id="submit-create-form-btn"
              onClick={() => handleCreateNewForm(false)}
            >
              <Check size={13} />
              Create &amp; open canvas
            </button>
          </>}
        >
          <Field label="Form name" hint="Display name used across admin and change order creation">
            <Input
              value={newFormName}
              autoFocus
              placeholder="e.g. Mechanical ECO Form"
              onChange={(e: any) => setNewFormName(e.target.value)}
            />
          </Field>
          <div style={{ height: 14 }} />
          <Field label="Change order type" hint="Which category of change orders this form governs">
            <Select
              value={newFormType}
              options={["ECO: Engineering Change Order", "DCO", "TPCO", "RFD"]}
              onChange={(e: any) => setNewFormType(e.target.value)}
            />
          </Field>
          <div style={{ height: 14 }} />
          <Field label="Description (optional)" hint="Short overview of the scope and use case">
            <Input
              value={newFormDesc}
              placeholder="e.g. Standard change order form for optics and sensor sub-assemblies"
              onChange={(e: any) => setNewFormDesc(e.target.value)}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}

export { Admin }


