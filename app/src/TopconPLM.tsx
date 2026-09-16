import { AskOverlay } from '@/components/shell/AskOverlay'
import { InspectRail } from '@/components/shell/InspectRail'
import { Nav } from '@/components/shell/Nav'
import { NotificationsOverlay } from '@/components/shell/NotificationsOverlay'
import { TopBar } from '@/components/shell/TopBar'
import { useCurrentUserRecord } from '@/data/admin'
import { HomePage } from '@/features/home/HomePage'
import { useAppRole, ROLE_DC, ROLE_APPROVER } from '@/lib/useAppRole'
import { CSS } from '@/theme/globalStyles'
import React, { lazy, Suspense, useState } from 'react'

const Admin = lazy(() => import('@/features/admin/AdminPage').then((m) => ({ default: m.Admin })))
const EcoDetail = lazy(() => import('@/features/eco/EcoDetail').then((m) => ({ default: m.EcoDetail })))
const EcoList = lazy(() => import('@/features/eco/EcoList').then((m) => ({ default: m.EcoList })))
const EcoNew = lazy(() => import('@/features/eco/EcoNew').then((m) => ({ default: m.EcoNew })))
const Inactivate = lazy(() => import('@/features/items/Inactivate').then((m) => ({ default: m.Inactivate })))
const ItemDetail = lazy(() => import('@/features/items/ItemDetail').then((m) => ({ default: m.ItemDetail })))
const ItemList = lazy(() => import('@/features/items/ItemList').then((m) => ({ default: m.ItemList })))
const ItemNew = lazy(() => import('@/features/items/ItemNew').then((m) => ({ default: m.ItemNew })))
const KitList = lazy(() => import('@/features/items/KitList').then((m) => ({ default: m.KitList })))
const PartsList = lazy(() => import('@/features/items/PartsList').then((m) => ({ default: m.PartsList })))
const Reports = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.Reports })))
const Suppliers = lazy(() => import('@/features/suppliers/SuppliersPage').then((m) => ({ default: m.Suppliers })))

/* ── Floating Ask AI FAB ─────────────────────────────────────────────
   Circle at rest → pill with "Ask AI" label on hover.
   Brand blue: #0A4F8F (rest) / #005fa8 (hover).                       */

function AskAiFab({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = React.useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask AI"
      data-test-id="floating-ask-ai-btn"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        right: 28,
        bottom: 28,
        height: 52,
        width: hovered ? 128 : 52,
        minWidth: 52,
        borderRadius: 999,
        background: hovered ? "#005fa8" : "#0A4F8F",

        boxShadow: hovered
          ? "0 4px 20px rgba(0,95,168,0.5), 0 2px 8px rgba(0,0,0,0.18)"
          : "0 2px 12px rgba(10,79,143,0.4), 0 1px 4px rgba(0,0,0,0.14)",

        display: "flex",
        alignItems: "center",
        border: "none",
        padding: 0,
        cursor: "pointer",
        zIndex: 60,
        outline: "none",
        overflow: "hidden",
        transition: "width .22s cubic-bezier(0.16,1,0.3,1), background .15s ease, box-shadow .15s ease",
        gap: "8px"
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: hovered ? "rgba(255,255,255,0.15)" : "transparent",
        transition: "background .15s ease",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2.5C14.5 6.5 17.5 9.5 21.5 9.5C17.5 9.5 14.5 12.5 14.5 16.5C14.5 12.5 11.5 9.5 7.5 9.5C11.5 9.5 14.5 6.5 14.5 2.5Z" />
          <path d="M6 14C6 16.2 7.8 18 10 18C7.8 18 6 19.8 6 22C6 19.8 4.2 18 2 18C4.2 18 6 16.2 6 14Z" />
        </svg>
      </div>
      {/* Label */}
      <span style={{
        color: "#ffffff",
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        paddingRight: hovered ? 16 : 0,
        maxWidth: hovered ? 76 : 0,
        opacity: hovered ? 1 : 0,
        transition: "max-width .22s cubic-bezier(0.16,1,0.3,1), opacity .14s ease, padding-right .22s cubic-bezier(0.16,1,0.3,1)",
        overflow: "hidden",
        letterSpacing: "-0.01em",
      }}>
        Ask AI
      </span>
    </button>
  );
}

/* =============================== APP ================================ */

function TopconPLM({
  initialPage,
  initialTab,
  initialId,
  startStep,
  initialFilter,
  initialRailOpen,
  initialRailMode,
  initialInspectedEcoId,
  initialAskOpen,
  initialInspectOpen,
  initialNotifOpen,
  initialApprovalMode,
  initialManualItems,
}: {
  initialPage?: string;
  initialTab?: string;
  initialId?: string;
  startStep?: number;
  initialFilter?: string;
  initialRailOpen?: boolean;
  initialRailMode?: "ask" | "inspect";
  initialInspectedEcoId?: string;
  initialAskOpen?: boolean;
  initialInspectOpen?: boolean;
  initialNotifOpen?: boolean;
  initialApprovalMode?: "ai" | "routing" | "manual" | null;
  initialManualItems?: any[] | null;
} = {}) {
  /* ---- Role-based access control ---- */
  const { role, isLoading: roleLoading, userName, userEmail } = useAppRole()
  const isApprover = role === 'approver'
  const isDC = role === 'dc'

  /* ---- Personalised user data — looked up by email from the plm_user object ---- */
  const { user: currentUser } = useCurrentUserRecord(userEmail ?? '')
  const userAiInsights = currentUser?.aiInsights ?? []
  const userNotifications = currentUser?.notifications ?? []

  const [v, setV] = useState<any>({ page: initialPage || "home", tab: initialTab, id: initialId, step: startStep, filter: initialFilter });
  const prevPageRef = React.useRef(initialPage);
  React.useEffect(() => {
    if (initialPage && initialPage !== prevPageRef.current) {
      prevPageRef.current = initialPage;
      setV({ page: initialPage, tab: initialTab, id: initialId, step: startStep, filter: initialFilter });
    }
  }, [initialPage, initialTab, initialId, startStep, initialFilter]);
  const [mini, setMini] = useState(true);

  const [askOpen, setAskOpen] = useState(
    initialAskOpen !== undefined
      ? initialAskOpen
      : Boolean(initialRailOpen && (initialRailMode === "ask" || !initialRailMode))
  );
  const [inspectOpen, setInspectOpen] = useState(
    initialInspectOpen !== undefined
      ? initialInspectOpen
      : Boolean(initialRailOpen && initialRailMode === "inspect")
  );
  const [notifOpen, setNotifOpen] = useState(initialNotifOpen ?? false);
  const [inspectedEcoId, setInspectedEcoId] = useState<string>(initialInspectedEcoId || "");
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  const unreadNotifCount = userNotifications.filter((n) => !readNotifIds.has(n.id)).length;

  // Separate modal open state — keeps the background page unchanged
  const [ecoNewOpen, setEcoNewOpen] = useState(false);
  const [ecoNewParams, setEcoNewParams] = useState<any>(null);
  const [itemNewOpen, setItemNewOpen] = useState(false);

  // Pages Approvers are allowed to navigate to
  const APPROVER_ALLOWED_PAGES = new Set(['home', 'ecos', 'eco', 'items', 'item', 'kits', 'parts', 'reports', 'inactivate'])
  const go = (next: any) => {
    // Approvers can only navigate to their allowed pages
    if (isApprover && next?.page && !APPROVER_ALLOWED_PAGES.has(next.page)) return
    // Creation modals open as overlays — don't change the background page
    if (next?.page === 'eco-new') { setEcoNewParams(next); setEcoNewOpen(true); return; }
    if (next?.page === 'item-new') { setItemNewOpen(true); return; }
    // Close modals when navigating elsewhere (e.g. after successful creation)
    setEcoNewOpen(false);
    setItemNewOpen(false);
    setV(next)
    window.scrollTo?.(0, 0)
  };

  const handleToggleAsk = () => {
    setAskOpen((prev: any) => !prev);
  };

  const handleToggleNotif = () => {
    setNotifOpen((prev: any) => !prev);
  };

  const handleInspectEco = (ecoId: string) => {
    setInspectedEcoId(ecoId);
    setInspectOpen(true);
  };

  const renderHeaderActions = () => (
    <TopBar
      notifOpen={notifOpen}
      unreadCount={unreadNotifCount}
      onToggleNotif={handleToggleNotif}
    />
  );

  let body = null;
  const currentPage = v.page || 'home'

  // Redirect approvers away from restricted pages
  const effectivePage = isApprover && !APPROVER_ALLOWED_PAGES.has(currentPage) ? 'home' : currentPage

  switch (effectivePage) {
    case "home": body = <HomePage go={go} renderHeaderActions={renderHeaderActions} userRole={role} userName={userName} aiInsights={userAiInsights} currentUser={currentUser} />; break;
    case "ecos": body = <EcoList go={go} initialFilter={isApprover ? "Needs me" : (v.filter ?? undefined)} onInspect={handleInspectEco} inspectedId={inspectedEcoId} railOpen={false} renderHeaderActions={renderHeaderActions} role={role} currentUserName={userName} />; break;
    case "eco": body = <EcoDetail id={v.id} go={go} initialTab={v.tab} renderHeaderActions={renderHeaderActions} role={role} currentUserName={userName} />; break;
    case "items": body = <ItemList go={go} railOpen={false} renderHeaderActions={renderHeaderActions} />; break;
    case "kits": body = <KitList go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "parts": body = <PartsList renderHeaderActions={renderHeaderActions} />; break;
    case "item": body = <ItemDetail id={v.id} go={go} initialTab={v.tab} renderHeaderActions={renderHeaderActions} from={v.from} />; break;
    case "inactivate": body = <Inactivate go={go} id={v.id} renderHeaderActions={renderHeaderActions} />; break;
    case "admin": body = !isApprover ? <Admin initialTab={v.tab || "Users"} go={go} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "reports": body = <Reports renderHeaderActions={renderHeaderActions} />; break;
    case "suppliers": body = !isApprover ? <Suppliers railOpen={false} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    default: body = <HomePage go={go} renderHeaderActions={renderHeaderActions} />;
  }

  const navPage = ["eco"].includes(v.page) ? "ecos"
    : ["item", "inactivate", "items"].includes(v.page) ? "kits"
    : v.page;

  return (
    <div className="tp" data-test-id="topcon-plm-app">
      <style>{CSS}</style>
      <Nav
        page={navPage}
        adminTab={v.page === "admin" ? (v.tab || "Users") : undefined}
        go={go}
        mini={mini}
        setMini={setMini}
        askOpen={askOpen}
        notifOpen={notifOpen}
        unreadCount={unreadNotifCount}
        onAsk={handleToggleAsk}
        onNotif={handleToggleNotif}
        role={role}
        userName={userName || undefined}
        userRole={role === 'dc' ? ROLE_DC : role === 'approver' ? ROLE_APPROVER : undefined}
      />
      <div className={`main ${mini ? "collapsed" : ""}`}>
        <div className="content-layout">
          <main className="wrap">
            <Suspense fallback={<div style={{ padding: 24 }} className="sub">Loading…</div>}>
              {body}
            </Suspense>
          </main>
        </div>
      </div>

      {/* ── Creation modals — overlay the current page ───────────────── */}
      <Suspense fallback={null}>
        {ecoNewOpen && (
          <EcoNew
            go={go}
            startStep={ecoNewParams?.step !== undefined ? ecoNewParams.step : 0}
            initialApprovalMode={initialApprovalMode}
            initialManualItems={ecoNewParams?.initialManualItems ?? initialManualItems}
            initialTitle={ecoNewParams?.initialTitle}
            initialDesc={ecoNewParams?.initialDesc}
            initialCat={ecoNewParams?.initialCat}
            isModal
            onClose={() => { setEcoNewOpen(false); setEcoNewParams(null); }}
          />
        )}
        {itemNewOpen && !isApprover && (
          <ItemNew
            go={go}
            isModal
            onClose={() => setItemNewOpen(false)}
          />
        )}
      </Suspense>

      {/* Floating Ask AI Button — hidden on Reports page since the full copilot is there */}
      {v.page !== "reports" && <AskAiFab onClick={handleToggleAsk} />}

      {inspectOpen && (
        <InspectRail
          open={inspectOpen}
          ecoId={inspectedEcoId}
          onClose={() => setInspectOpen(false)}
          go={go}
        />
      )}

      {askOpen && (
        <AskOverlay
          open={askOpen}
          onClose={() => setAskOpen(false)}
          go={go}
        />
      )}

      {notifOpen && (
        <NotificationsOverlay
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          go={go}
          notifications={userNotifications}
          readIds={readNotifIds}
          onMarkRead={(id: string) => setReadNotifIds((prev) => new Set([...prev, id]))}
          onMarkAllRead={() => setReadNotifIds(new Set(userNotifications.map((n) => n.id)))}
        />
      )}
    </div>
  );
}

export { TopconPLM }

export default TopconPLM
