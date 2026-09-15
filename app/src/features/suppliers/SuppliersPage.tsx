import { PartAccess } from '@/components/pickers/PartAccess'
import { Card } from '@/components/primitives/Card'
import { Chip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Kpi } from '@/components/primitives/Kpi'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { PEOPLE } from '@/domain/people'
import { SUPPLIERS } from '@/domain/suppliers'
import { T } from '@/theme/tokens'
import { Check, CheckCircle2, Download, Link2, Pencil, Plus, Send, ShieldCheck, Users } from 'lucide-react'
import React, { useState } from 'react'

function Suppliers({ railOpen = false, renderHeaderActions }: { railOpen?: boolean; renderHeaderActions?: () => React.ReactNode } = {}) {
  const [list, setList] = useState(SUPPLIERS);
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("All");
  const [modal, setModal] = useState<any>(null);
  const [sent, setSent] = useState(false);
  const [supplierPage, setSupplierPage] = useState(0);
  const segs = ["All", "Portal enabled", "No portal", "Invited"];
  const match = (r: any, x: any) => x === "All" || (x === "Portal enabled" ? r.portal && r.st !== "Invited"
    : x === "No portal" ? !r.portal : r.st === "Invited");
  const count = (x: any) => list.filter((r: any) => match(r, x)).length;
  const rows = list.filter((r: any) => match(r, seg) && (r.n + r.site + r.c).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="stack" data-test-id="suppliers-page">
      <div className="bet">
        <div>
          <div className="crumb">Suppliers</div>
          <h1>Suppliers</h1>
          <div className="sub" style={{ marginTop: 4 }}>Manage supplier accounts, portal access, and shared item visibility</div>
        </div>
        <div className="row">
          <button className="btn pri" onClick={() => { setSent(false); setModal({ n: "", e: "", c: "", site: "", portal: true, notify: "Change complete", access: "View items shared with them" }); }}>
            <Plus size={13} strokeWidth={2} />Add supplier</button>
          {renderHeaderActions?.()}
        </div>
      </div>

      <div className="grid4">
        <Kpi label="Supplier accounts" value={list.length} note="Across 12 countries" icon={Users} />
        <Kpi label="Portal enabled" value={list.filter((r: any) => r.portal).length} note="Can sign in and see shared items" icon={ShieldCheck} tint={T.okBg} bd={T.okBd} tone={T.ok} />
        <Kpi label="Partner users" value={PEOPLE.filter((p: any) => p.type === "Partner").length} note="Contract engineering" icon={Link2} tint={T.tealBg} bd={T.tealBd} tone={T.teal} />
        <Kpi label="Invitations pending" value={list.filter((r: any) => r.st === "Invited").length} note="Sent 9 Sep, expires in 11 days" icon={Send} tint={T.warnBg} bd={T.warnBd} tone={T.warn} />
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Supplier, site or contact" segs={segs} seg={seg} setSeg={setSeg} count={count}
          right={<button className="btn"><Download size={13} />Export</button>} />
      <Card pad={false}>
        <table className="tbl">
          <thead><tr>
            <th>Supplier</th>
            <th>Site</th>
            <th style={{ textAlign: "right" }}>Supplier items</th>
            {!railOpen && <th>Portal access</th>}
            {!railOpen && <th>Notified on</th>}
            {!railOpen && <th>Primary contact</th>}
            {!railOpen && <th>Status</th>}
            <th></th></tr></thead>
          <tbody>
            {rows.slice(supplierPage * PAGE_SIZE, (supplierPage + 1) * PAGE_SIZE).map((r: any) => (
              <tr key={r.n}>
                <td style={{
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: railOpen ? 220 : undefined,
                }} title={r.n}>{r.n}</td>
                <td className="sub" style={{ whiteSpace: "nowrap" }}>{r.site}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r.items || <span className="mut">—</span>}</td>
                {!railOpen && <td>{r.portal ? <Chip k="ok" icon={ShieldCheck}>Enabled</Chip> : <Chip k="gray">None</Chip>}</td>}
                {!railOpen && <td className="sub">{r.notify}</td>}
                {!railOpen && <td><div>{r.c}</div><div className="mini">{r.e}</div></td>}
                {!railOpen && <td>{r.st === "Invited" ? <Chip k="warn">Invitation sent</Chip>
                  : r.st === "Partner" ? <Chip k="teal">Partner</Chip> : <Chip k="ok">Active</Chip>}</td>}
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn sm" onClick={() => { setSent(false); setModal({ ...r, edit: true }); }}><Pencil size={12} />Edit</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={railOpen ? 4 : 8}><Empty icon={Users} title="No suppliers match"
              body="Try another name, site or contact." /></td></tr>}
          </tbody>
        </table>
        <Pagination total={rows.length} page={supplierPage} setPage={setSupplierPage} />
      </Card>

      <div className="note">
        Suppliers see a change only once it completes, and only the items shared with them. Access granted on an assembly can optionally
        extend to its BOM. The external supplier portal runs on a separate URL from the internal application.
      </div>

      {modal && (
        <Modal title={modal.edit ? `Edit ${modal.n}` : "Add supplier"} onClose={() => setModal(null)}
          foot={sent ? <button className="btn pri" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>Done</button>
            : <>
              <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>Cancel</button>
              <button className="btn pri" disabled={!modal.n || !modal.e} onClick={() => {
                setList(modal.edit ? list.map((r: any) => r.n === modal.n ? { ...modal, edit: undefined } : r)
                  : [...list, { ...modal, items: 0, st: modal.portal ? "Invited" : "Active" }]);
                if (modal.portal) setSent(true); else setModal(null);
              }}>
                {modal.portal ? <><Send size={13} />{modal.edit ? "Save and re-send invitation" : "Create and send invitation"}</>
                  : <><Check size={13} />{modal.edit ? "Save changes" : "Create supplier"}</>}
              </button>
            </>}>
          {sent ? (
            <div className="stack">
              <div className="okbox"><CheckCircle2 size={15} />
                <div><b>Invitation sent to {modal.e}.</b> {modal.c || "The contact"} has 14 days to accept and set a password.</div></div>
              <div className="card" style={{ overflow: "hidden" }}>
                <table className="tbl">
                  <tbody>
                    <tr><td className="sub">Supplier</td><td style={{ fontWeight: 600 }}>{modal.n}</td></tr>
                    <tr><td className="sub">Portal URL</td><td className="pn">suppliers.topcon-plm.com</td></tr>
                    <tr><td className="sub">Access</td><td>{modal.access}</td></tr>
                    <tr><td className="sub">Parts shared</td><td>{(modal.parts || []).length
                      ? <span className="row" style={{ flexWrap: "wrap", gap: 5 }}>
                          {modal.parts.map((x: any) => <span key={x} className="chip c-blue">{x}</span>)}</span>
                      : <span className="mut">None yet — share items from the item’s Supplier access tab</span>}</td></tr>
                    <tr><td className="sub">Notified on</td><td>{modal.notify}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="note">Nothing is visible to them until you share an item or a change. Sharing happens on the item’s
                Supplier access tab, or on the change itself.</div>
            </div>
          ) : (
            <div className="stack">
              <div className="grid2">
                <Field label="Supplier name"><Input value={modal.n} autoFocus placeholder="Pacific Metal Forming"
                  onChange={(e: any) => setModal({ ...modal, n: e.target.value })} /></Field>
                <Field label="Site"><Input value={modal.site} placeholder="Livermore, CA"
                  onChange={(e: any) => setModal({ ...modal, site: e.target.value })} /></Field>
                <Field label="Primary contact"><Input value={modal.c} placeholder="R. Alvarez"
                  onChange={(e: any) => setModal({ ...modal, c: e.target.value })} /></Field>
                <Field label="Contact email"><Input value={modal.e} placeholder="name@supplier.com"
                  onChange={(e: any) => setModal({ ...modal, e: e.target.value })} /></Field>
              </div>
              <div className="togglerow">
                <div><b>Invite them to the supplier portal</b>
                  <div className="mini">Sends a sign-in invitation. Leave off to keep this as a record-only supplier.</div></div>
                <input type="checkbox" checked={modal.portal} onChange={(e: any) => setModal({ ...modal, portal: e.target.checked })} />
              </div>
              {modal.portal && (<>
                <Field label="What they can do">
                  <div className="optcards">
                    {[["View items shared with them", "Read the spec and BOM of items you explicitly share"],
                      ["View and comment on changes", "Also see change orders their items appear on, and leave comments"],
                      ["Approve changes", "Sign off as an approver on changes that involve their parts"]].map(([l, d]: any) => (
                      <button key={l} className={`optcard ${modal.access === l ? "on" : ""}`} onClick={() => setModal({ ...modal, access: l })}>
                        <div className="row" style={{ gap: 8 }}><span className={`radio ${modal.access === l ? "on" : ""}`} /><b>{l}</b></div>
                        <div className="mini" style={{ marginTop: 4, paddingLeft: 24 }}>{d}</div>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Notify them on" hint="Suppliers are never notified while a change is still in routing.">
                  <Select value={modal.notify} options={["Change complete", "Every status change", "Never"]}
                    onChange={(e: any) => setModal({ ...modal, notify: e.target.value })} />
                </Field>
                <Field label={`Parts they supply (${(modal.parts || []).length})`}
                  hint="Only these items become visible to them. Everything else stays hidden.">
                  <PartAccess value={modal.parts || []} onChange={(parts: any) => setModal({ ...modal, parts })} />
                </Field>
              </>)}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

export { Suppliers }


