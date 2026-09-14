import { NOTIFS } from '@/domain/notifications'
import { T } from '@/theme/tokens'
import { Bell, X } from 'lucide-react'
import React from 'react'

function NotificationsOverlay({
  open,
  onClose,
  go,
  readIds,
  onMarkRead,
  onMarkAllRead,
}: {
  open: boolean;
  onClose: () => void;
  go: (v: any) => void;
  readIds: Set<string>;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const unreadCount = NOTIFS.filter((n: any) => !readIds.has(n.id)).length;

  return (
    <>
      <div
        className="modalbg"
        style={{ background: "rgba(3,38,68,.28)", zIndex: 65 }}
        onClick={onClose}
        data-test-id="notif-scrim"
      />
      <aside
        className="drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          height: "100vh",
          background: "#fff",
          boxShadow: "-10px 0 40px rgba(2,42,66,.2)",
          borderRadius: "10px 0 0 10px",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        data-test-id="notif-panel"
        aria-label="Notifications panel"
      >
        <div
          className="drawerhead"
          style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${T.g100}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
            flex: "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Bell size={16} color={T.brand} strokeWidth={2} />
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T.g900 }}>Notifications</h2>
            {unreadCount > 0 && (
              <span className="chip c-blue" style={{ fontSize: 11, padding: "2px 6px" }}>{unreadCount} new</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              type="button"
              className="btn gh sm"
              onClick={onMarkAllRead}
              data-test-id="notif-mark-all-read"
            >
              Mark all read
            </button>
            <button
              type="button"
              className="btn gh sm"
              onClick={onClose}
              aria-label="Close"
              data-test-id="notif-close-btn"
            >
              <X size={15} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} data-test-id="notifications-list">
          {["Today", "Earlier"].map((groupName: any) => {
            const groupItems = NOTIFS.filter((n: any) => (n.group || (n.meta.includes("day") ? "Earlier" : "Today")) === groupName);
            if (!groupItems.length) return null;
            return (
              <div key={groupName}>
                <div
                  style={{
                    padding: "10px 16px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.g600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    background: T.g50,
                    borderBottom: `1px solid ${T.g100}`
                  }}
                >
                  {groupName}
                </div>
                {groupItems.map((n: any) => {
                  const isUnread = !readIds.has(n.id);
                  const timeDisplay = n.timestamp || (n.meta.includes("14 minutes") ? "14 minutes ago" : n.meta.includes("2 hours") ? "2 hours ago" : n.meta.includes("3 hours") ? "3 hours ago" : "1 day ago");
                  return (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "11px 16px",
                        borderBottom: `1px solid ${T.g100}`,
                        cursor: "pointer",
                        background: isUnread ? "rgba(230, 242, 251, 0.45)" : "#fff",
                        transition: "background .12s"
                      }}
                      onClick={() => {
                        onMarkRead(n.id);
                        go(n.go);
                        onClose();
                      }}
                      data-test-id={`notif-row-${n.id}`}
                    >
                      {/* Unread dot left */}
                      <div style={{ paddingTop: 6, flex: "none" }}>
                        <span
                          style={{
                            display: "block",
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: isUnread ? T.brand : "transparent"
                          }}
                          data-test-id={`notif-dot-${n.id}`}
                        />
                      </div>

                      {/* Content in center */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
                          <span className="pn" style={{ fontSize: 13, fontWeight: 600 }}>{n.id}</span>
                          <span style={{ fontSize: 13, color: T.g900, fontWeight: isUnread ? 600 : 500 }}>
                            {n.title}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: T.g600, marginTop: 2 }}>
                          {n.detail || n.meta.split(" · ")[0]}
                        </div>
                      </div>

                      {/* Timestamp right */}
                      <div style={{ flex: "none", fontSize: 11, color: T.g500, whiteSpace: "nowrap", paddingTop: 2 }}>
                        {timeDisplay}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

export { NotificationsOverlay }


