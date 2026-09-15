import { NAV } from '@/domain/navigation'
import { ME } from '@/domain/session'
import type { AppRole } from '@/lib/useAppRole'
import { useLogout } from '@unifyapps/app-builder-sdk/hooks/auth'
import { ChevronDown, ChevronRight, LogOut, PanelLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Nav({
  page,
  adminTab,
  go,
  mini,
  setMini,
  onAsk,
  onNotif,
  railOpen,
  railMode,
  askOpen,
  notifOpen,
  unreadCount = 4,
  role = 'unknown',
  userName,
  userRole,
}: {
  page: string;
  adminTab?: string;
  go: (next: any) => void;
  mini: boolean;
  setMini: (mini: boolean) => void;
  onAsk?: () => void;
  onNotif?: () => void;
  railOpen?: boolean;
  railMode?: "ask" | "inspect";
  askOpen?: boolean;
  notifOpen?: boolean;
  unreadCount?: number;
  role?: AppRole;
  userName?: string;
  userRole?: string;
}) {
  const navigate = useNavigate();
  const [brandHover, setBrandHover] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(page === "admin");
  const [itemsMenuOpen, setItemsMenuOpen] = useState(page === "kits" || page === "parts");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userBtnRef = useRef<HTMLButtonElement>(null);
  const logout = useLogout();

  function handleLogout() {
    setUserMenuOpen(false);
    logout.mutate(undefined, {
      onSuccess: () => navigate('/login'),
      onError: () => navigate('/login'),
    });
  }

  // Compute popover position from button rect so it works in both expanded + collapsed
  function getPopoverStyle(): React.CSSProperties {
    const rect = userBtnRef.current?.getBoundingClientRect();
    if (!rect) return { display: 'none' };
    return {
      position: 'fixed',
      bottom: `calc(100vh - ${rect.top}px + 8px)`,
      left: mini ? rect.right + 8 : rect.left,
      width: mini ? 220 : Math.max(rect.width, 220),
      zIndex: 9999,
    };
  }

  const Item = ({ k, label, icon: Ic, onClick, active, count, hasChevron, chevronOpen }: {
    k: string;
    label: string;
    icon: any;
    onClick?: () => void;
    active?: boolean;
    count?: number;
    hasChevron?: boolean;
    chevronOpen?: boolean;
  }) => (
    <button className={`sideitem ${active ? "on" : ""}`} title={mini ? label : undefined} data-test-id={`nav-item-${k}`} aria-label={label}
      onClick={onClick || (() => {
        if (k === "admin") {
          if (!mini) {
            // Expanded: just toggle the dropdown, don't navigate
            setAdminMenuOpen((prev: any) => !prev);
          } else {
            // Collapsed: navigate to admin/Users
            go({ page: "admin", tab: adminTab || "Users" });
            try { navigate("/admin"); } catch (e) {}
          }
        } else {
          go({ page: k });
          try { navigate(k === "home" ? "/" : `/${k}`); } catch (e) {}
        }
      })}>
      <Ic size={16} /><span className="lbl">{label}</span>
      {count ? <span className="cnt lbl">{count}</span> : null}
      {hasChevron && !mini && (
        <span className="lbl" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", opacity: active ? 0.9 : 0.6 }}>
          {chevronOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      )}
    </button>
  );

  return (
    <aside className={`side ${mini ? "collapsed" : ""}`} data-test-id="side-nav">
      {mini ? (
        /* Collapsed Mode:
           - Non-hover: small logo (small.svg)
           - On hover: hover button with expand/sidebar icon (PanelLeft)
        */
        <div
          style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", border: "none" }}
          onMouseEnter={() => setBrandHover(true)}
          onMouseLeave={() => setBrandHover(false)}>
          <button
            onClick={() => setMini(false)}
            data-test-id="sidebar-toggle-btn"
            title="Expand sidebar"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              border: "none",
              background: brandHover ? "rgba(255,255,255,.16)" : "transparent",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              padding: 0,
              color: "#fff",
              transition: "all .15s ease"
            }}>
            {brandHover ? (
              <PanelLeft size={20} color="#FFFFFF" strokeWidth={2} />
            ) : (
              <img src={`${import.meta.env.BASE_URL}small.svg`} alt="Topcon" style={{ width: 28, height: 28, objectFit: "contain" }} />
            )}
          </button>
        </div>
      ) : (
        /* Expanded Mode:
           - Big icon/logo on the left
           - On its side: hover button to toggle/collapse sidebar (PanelLeft)
        */
        <div style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          border: "none"
        }}>
          <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <img
              src={`${import.meta.env.BASE_URL}wide.webp`}
              alt="TOPCON PLM"
              style={{ maxWidth: 148, maxHeight: 32, objectFit: "contain" }}
            />
          </div>
          <button
            onClick={() => setMini(true)}
            data-test-id="sidebar-toggle-btn"
            title="Collapse sidebar"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#E1F0FF",
              padding: 0,
              flex: "none",
              transition: "background .15s, color .15s"
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.background = "rgba(255,255,255,.16)";
              e.currentTarget.style.color = "#FFFFFF";
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#E1F0FF";
            }}>
            <PanelLeft size={19} strokeWidth={2} />
          </button>
        </div>
      )}

      <nav className="sidenav">
        {/* Home — visible to all */}
        <Item {...NAV[0]} active={page === "home"} />

        {/* Product record section — Approver sees Changes + Items; DC sees all */}
        <div className="sidelbl">Product record</div>
        <Item
          {...NAV[1]}
          active={page === "ecos"}
          count={role === 'approver' ? undefined : 22}
          label={role === 'approver' ? 'My changes' : (NAV[1].label as string)}
        />
        <Item
          {...NAV[2]}
          active={page === "kits" || page === "parts"}
          hasChevron={true}
          chevronOpen={itemsMenuOpen || page === "kits" || page === "parts"}
          onClick={() => {
            if (!mini) {
              setItemsMenuOpen((prev: boolean) => !prev);
            } else {
              go({ page: "kits" });
            }
          }}
        />
        {(itemsMenuOpen || page === "kits" || page === "parts") && !mini && (
          <div className="sidesubmenu" data-test-id="items-subnav">
            {[
              { id: "kits", label: "Kits" },
              { id: "parts", label: "Parts" },
            ].map((sub) => {
              const isSubActive = page === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  className={`sidesubitem ${isSubActive ? "on" : ""}`}
                  data-test-id={`items-subitem-${sub.id}`}
                  onClick={() => {
                    go({ page: sub.id });
                    try { navigate(`/${sub.id}`); } catch (e) {}
                  }}
                >
                  {sub.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Insight & setup — DC only */}
        {role !== 'approver' && (
          <>
            <div className="sidelbl">Insight &amp; setup</div>
            <Item {...NAV[3]} active={page === "reports"} />
            <Item {...NAV[4]} active={page === "admin"} hasChevron={true} chevronOpen={adminMenuOpen || page === "admin"} />
            {(adminMenuOpen || page === "admin") && !mini && (
              <div className="sidesubmenu" data-test-id="admin-subnav">
                {[
                  { id: "Users", label: "Users" },
                  { id: "Roles", label: "Roles" },
                  { id: "Routings", label: "Routings" },
                  { id: "Form Builder", label: "Form Builder" },
                ].map((sub: any) => {
                  const isSubActive = (adminTab || "Users") === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      className={`sidesubitem ${isSubActive ? "on" : ""}`}
                      data-test-id={`admin-subitem-${sub.id.toLowerCase().replace(/\s+/g, "-")}`}
                      onClick={() => {
                        go({ page: "admin", tab: sub.id });
                        try { navigate("/admin"); } catch (e) {}
                      }}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </nav>

      <div className="sidefoot">
        {/* Click-outside backdrop */}
        {userMenuOpen && (
          <div
            aria-hidden="true"
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setUserMenuOpen(false)}
          />
        )}

        {/* User menu popover — fixed-positioned so it always escapes the sidebar */}
        {userMenuOpen && (
          <div
            role="menu"
            data-test-id="sidebar-user-menu"
            style={{
              ...getPopoverStyle(),
              background: '#ffffff',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,.08)',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,.06), 0 12px 24px -4px rgba(0,0,0,.12)',
              overflow: 'hidden',
              animation: 'fadeSlideUp .14s ease',
            }}
          >
            {/* Avatar + identity */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'linear-gradient(135deg,#0A4F8F,#1a73c8)',
                display: 'grid', placeItems: 'center',
                fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>
                {(userName || ME.name).charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {userName || ME.name}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                  {userRole || ME.role}
                </div>
              </div>
            </div>

            {/* Sign out row */}
            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={logout.isPending}
              data-test-id="sidebar-signout-btn"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 14px',
                background: 'none', border: 'none', cursor: logout.isPending ? 'wait' : 'pointer',
                fontSize: 13, color: '#64748b', fontWeight: 500, textAlign: 'left',
                transition: 'background .12s, color .12s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#64748b'; }}
            >
              <LogOut size={14} strokeWidth={2} />
              {logout.isPending ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        )}

        <button
          ref={userBtnRef}
          className="sideuser"
          title={`${userName || ME.name} — ${userRole || ME.role}`}
          onClick={() => setUserMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={userMenuOpen}
          data-test-id="sidebar-user-btn"
        >
          <div className="avatar">{(userName || ME.name).charAt(0).toUpperCase()}</div>
          {!mini && (
            <div className="lbl" style={{ lineHeight: 1.35, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#FFFFFF' }}>
                {userName || ME.name}
              </div>
              <div style={{ fontSize: 11, color: '#B9DCFF' }}>{userRole || ME.role}</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

export { Nav }


