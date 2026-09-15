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
const Reports = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.Reports })))
const Suppliers = lazy(() => import('@/features/suppliers/SuppliersPage').then((m) => ({ default: m.Suppliers })))

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
  const [inspectedEcoId, setInspectedEcoId] = useState<string>(initialInspectedEcoId || "ECO-011420");
  const [readNotifIds, setReadNotifIds] = useState<Set<string>>(new Set());

  const unreadNotifCount = userNotifications.filter((n) => !readNotifIds.has(n.id)).length;

  // Pages Approvers are allowed to navigate to
  const APPROVER_ALLOWED_PAGES = new Set(['home', 'ecos', 'eco', 'items', 'item'])
  const go = (next: any) => {
    // Approvers can only navigate to their allowed pages
    if (isApprover && next?.page && !APPROVER_ALLOWED_PAGES.has(next.page)) return
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
    case "eco-new": body = !isApprover ? <EcoNew go={go} startStep={v.step !== undefined ? v.step : 0} initialApprovalMode={initialApprovalMode} initialManualItems={initialManualItems} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "items": body = <ItemList go={go} railOpen={false} renderHeaderActions={renderHeaderActions} />; break;
    case "item": body = <ItemDetail id={v.id} go={go} initialTab={v.tab} renderHeaderActions={renderHeaderActions} />; break;
    case "item-new": body = !isApprover ? <ItemNew go={go} renderHeaderActions={renderHeaderActions} /> : <ItemList go={go} railOpen={false} renderHeaderActions={renderHeaderActions} />; break;
    case "inactivate": body = !isApprover ? <Inactivate go={go} id={v.id} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "admin": body = !isApprover ? <Admin initialTab={v.tab || "Users"} go={go} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "reports": body = !isApprover ? <Reports renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    case "suppliers": body = !isApprover ? <Suppliers railOpen={false} renderHeaderActions={renderHeaderActions} /> : <HomePage go={go} renderHeaderActions={renderHeaderActions} />; break;
    default: body = <HomePage go={go} renderHeaderActions={renderHeaderActions} />;
  }

  const navPage = ["eco", "eco-new"].includes(v.page) ? "ecos"
    : ["item", "item-new", "inactivate"].includes(v.page) ? "items" : v.page;

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

      {/* Floating Ask AI Button — hidden on Reports page since the full copilot is there */}
      {v.page !== "reports" && <button
        type="button"
        onClick={handleToggleAsk}
        data-test-id="floating-ask-ai-btn"
        title="Ask AI"
        aria-label="Ask AI"
        style={{
          position: "fixed",
          right: 28,
          bottom: 28,
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: "#EDE9DE",
          boxShadow: "0 0 0 1px rgba(0, 35, 65, 0.2), 0 6px 20px rgba(10, 79, 143, 0.35), 0 2px 6px rgba(0, 0, 0, 0.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 60,
          padding: 4,
          transition: "transform .18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .18s ease",
          outline: "none"
        }}
        onMouseEnter={(e: any) => {
          e.currentTarget.style.transform = "scale(1.08)";
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(10, 79, 143, 0.32), 0 8px 24px rgba(10, 79, 143, 0.45), 0 3px 8px rgba(0, 0, 0, 0.16)";
          const inner = e.currentTarget.querySelector(".ai-inner-circle") as HTMLElement;
          if (inner) inner.style.background = "#005fa8";
        }}
        onMouseLeave={(e: any) => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(0, 35, 65, 0.2), 0 6px 20px rgba(10, 79, 143, 0.35), 0 2px 6px rgba(0, 0, 0, 0.12)";
          const inner = e.currentTarget.querySelector(".ai-inner-circle") as HTMLElement;
          if (inner) inner.style.background = "#0A4F8F";
        }}
        onMouseDown={(e: any) => {
          e.currentTarget.style.transform = "scale(0.96)";
        }}
        onMouseUp={(e: any) => {
          e.currentTarget.style.transform = "scale(1.08)";
        }}
      >
        <div
          className="ai-inner-circle"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "#0A4F8F",
            color: "#FFFFFF",
            display: "grid",
            placeItems: "center",
            boxShadow: "0 0 0 1px rgba(0, 35, 65, 0.32), inset 0 1px 1.5px rgba(255, 255, 255, 0.25)",
            transition: "background .18s ease",
            pointerEvents: "none"
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ display: "block" }}
          >
            {/* Main 4-pointed sparkle in upper right */}
            <path d="M14.5 2.5C14.5 6.5 17.5 9.5 21.5 9.5C17.5 9.5 14.5 12.5 14.5 16.5C14.5 12.5 11.5 9.5 7.5 9.5C11.5 9.5 14.5 6.5 14.5 2.5Z" />
            {/* Smaller 4-pointed sparkle in lower left */}
            <path d="M6 14C6 16.2 7.8 18 10 18C7.8 18 6 19.8 6 22C6 19.8 4.2 18 2 18C4.2 18 6 16.2 6 14Z" />
          </svg>
        </div>
      </button>}

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
