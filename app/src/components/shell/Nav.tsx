import { NAV } from '@/domain/navigation'
import { ME } from '@/domain/session'
import { ChevronDown, ChevronRight, PanelLeft } from 'lucide-react'
import { useState } from 'react'
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
}) {
  const navigate = useNavigate();
  const [brandHover, setBrandHover] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(page === "admin");

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
        <Item {...NAV[0]} active={page === "home"} />
        <div className="sidelbl">Product record</div>
        <Item {...NAV[1]} active={page === "ecos"} count={22} />
        <Item {...NAV[2]} active={page === "items"} />
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
      </nav>

      <div className="sidefoot">
        <button className="sideuser" title={`${ME.name} — ${ME.role}`} data-test-id="sidebar-user-btn">
          <div className="avatar">{ME.init}</div>
          <div className="lbl" style={{ lineHeight: 1.35, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#FFFFFF" }}>{ME.name}</div>
            <div style={{ fontSize: 11, color: "#B9DCFF" }}>{ME.role}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

export { Nav }


