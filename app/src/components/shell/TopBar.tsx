import { Bell } from 'lucide-react'

function TopBar({
  notifOpen,
  unreadCount = 0,
  onToggleNotif,
}: {
  notifOpen?: boolean;
  unreadCount?: number;
  onToggleNotif?: () => void;
}) {
  return (
    <div
      style={{ display: "inline-flex", alignItems: "center", gap: 8, height: 32 }}
      data-test-id="app-topbar"
    >
      <button
        type="button"
        className={`iconbtn ${notifOpen ? "on" : ""}`}
        onClick={onToggleNotif}
        data-test-id="header-notif-btn"
        title="Notifications"
      >
        <Bell size={16} strokeWidth={2} />
        {unreadCount > 0 && <span className="dotr" />}
      </button>
    </div>
  );
}

export { TopBar }


