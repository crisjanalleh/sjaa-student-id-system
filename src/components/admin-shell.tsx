"use client";

import {
  Bell,
  IdCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  QrCode,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
  MapPin,
  ChevronDown,
  ChevronRight,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { SCHOOL } from "@/lib/config";
import DisplayPreferences from "@/components/display-preferences";
import SjaaLogo from "@/components/sjaa-logo";
import ManilaClock from "@/components/manila-clock";
import PrintProgressDock from "@/components/print-progress/print-progress-dock";
import type { UnreadCounts, UnreadSection } from "@/lib/unread";

const NAV: { href: string; label: string; icon: LucideIcon; exact: boolean; unread?: UnreadSection }[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/applications", label: "Applications", icon: Inbox, exact: false, unread: "applications" },
  { href: "/admin/print", label: "Batch Print", icon: Printer, exact: false },
  { href: "/admin/template", label: "ID Template", icon: IdCard, exact: false },
  { href: "/admin/qr", label: "QR Codes", icon: QrCode, exact: false },
  { href: "/admin/notifications", label: "Notifications", icon: Bell, exact: false, unread: "notifications" },
  { href: "/admin/audit", label: "Audit Trail", icon: ScrollText, exact: false },
];

const UNREAD_POLL_MS = 4_000;
const COLLAPSE_KEY = "sjaa-sidebar-collapsed";
const collapseListeners = new Set<() => void>();

function subscribeCollapsed(listener: () => void) {
  collapseListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    collapseListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function getCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsedPref(value: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    /* storage unavailable: preference is not saved */
  }
  collapseListeners.forEach((listener) => listener());
}

function badgeText(count: number) {
  return count > 99 ? "99+" : String(count);
}

export default function AdminShell({
  fullName,
  username,
  avatarDataUrl,
  csrfToken,
  initialUnread,
  children,
}: {
  fullName: string;
  username: string;
  avatarDataUrl: string | null;
  csrfToken: string;
  initialUnread: UnreadCounts;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [signOutOpen, setSignOutOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, getCollapsed, () => false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [unread, setUnread] = useState<UnreadCounts>(initialUnread);
  const activeSection = NAV.find((item) => item.unread && pathname.startsWith(item.href))?.unread ?? null;

  function toggleCollapsed() {
    setCollapsedPref(!collapsed);
  }

  function openWorkspace() {
    if (collapsed) {
      setCollapsedPref(false);
      setWorkspaceOpen(true);
      return;
    }
    setWorkspaceOpen((open) => !open);
  }

  useEffect(() => {
    if (!drawerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [drawerOpen]);

  useEffect(() => {
    if (!signOutOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !loggingOut) setSignOutOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [signOutOpen, loggingOut]);

  // Opening a section marks it read; while it stays open, new arrivals refresh the page and are marked read too.
  useEffect(() => {
    let stopped = false;
    async function sync(refreshIfNew: boolean) {
      try {
        let response = await fetch("/api/admin/unread", { cache: "no-store" });
        let data = (await response.json()) as { ok?: boolean; counts?: UnreadCounts };
        if (!response.ok || !data.counts || stopped) return;
        if (activeSection && (!refreshIfNew || data.counts[activeSection] > 0)) {
          const hadNew = data.counts[activeSection] > 0;
          response = await fetch("/api/admin/unread", {
            method: "POST",
            headers: { "content-type": "application/json", "x-csrf-token": csrfToken },
            body: JSON.stringify({ section: activeSection }),
          });
          data = (await response.json()) as { ok?: boolean; counts?: UnreadCounts };
          if (hadNew && refreshIfNew && !stopped) router.refresh();
        }
        if (data.counts && !stopped) setUnread(data.counts);
      } catch {
        /* offline or signed out: keep the last known counts */
      }
    }
    void sync(false);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void sync(true);
    }, UNREAD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeSection, csrfToken, router]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      if (!response.ok) {
        setLogoutError("Could not sign out. Please try again.");
        return;
      }
      setSignOutOpen(false);
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("Connection problem while signing out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  const avatar = (
    <span className="sb-avatar flex shrink-0 overflow-hidden">
      {avatarDataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
      ) : fullName.trim().charAt(0).toUpperCase() || <UserRound className="h-5 w-5" aria-hidden />}
    </span>
  );

  return (
    <div className="admin-app" data-collapsed={collapsed} data-drawer={drawerOpen}>
      <div className="sb-topbar no-print">
        <button type="button" className="sb-icon-btn" onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <SjaaLogo className="h-8 w-8 object-contain" />
        <span className="truncate text-sm font-bold">Student ID Administration</span>
        {unread.applications + unread.notifications > 0 && (
          <span className="nav-badge ml-auto" aria-label={`${unread.applications + unread.notifications} new`}>
            {badgeText(unread.applications + unread.notifications)}
          </span>
        )}
      </div>
      <button
        type="button"
        className="sb-backdrop no-print"
        aria-label="Close navigation menu"
        tabIndex={drawerOpen ? 0 : -1}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className="sidebar no-print" aria-label="Administration sidebar">
        <div className="sb-head">
          <SjaaLogo className="sb-logo object-contain" priority />
          <div className="sb-label min-w-0 flex-1">
            <p className="sb-school-name">{SCHOOL.name}</p>
            <p className="sb-school-sub">Student ID Administration</p>
          </div>
          <button
            type="button"
            className="sb-icon-btn sb-collapse-btn"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden /> : <PanelLeftClose className="h-5 w-5" aria-hidden />}
          </button>
          <button type="button" className="sb-icon-btn sb-close-btn" onClick={() => setDrawerOpen(false)} aria-label="Close navigation menu">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="sb-scroll">
          <div className="sb-clock">
            <ManilaClock />
          </div>

          <nav className="sb-nav" aria-label="Administration">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const count = item.unread ? unread[item.unread] : 0;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={active}
                  className="sb-link"
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon className="sb-icon" aria-hidden />
                  <span className="sb-label">{item.label}</span>
                  {count > 0 && (
                    <span className="nav-badge sb-badge" aria-label={`${count} new`}>
                      {badgeText(count)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="sb-workspace" data-open={workspaceOpen && !collapsed}>
            <button
              type="button"
              className="sb-link sb-workspace-toggle"
              onClick={openWorkspace}
              aria-expanded={workspaceOpen && !collapsed}
              aria-controls="sb-workspace-body"
              title={collapsed ? "Workspace" : undefined}
            >
              <SlidersHorizontal className="sb-icon" aria-hidden />
              <span className="sb-label">Workspace</span>
              <ChevronDown className="sb-chevron sb-label" aria-hidden />
            </button>
            <div className="sb-workspace-body" id="sb-workspace-body" inert={!workspaceOpen || collapsed}>
              <div className="sb-workspace-inner">
                <div className="ws-groups">
                  <DisplayPreferences />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sb-foot">
          <Link
            href="/admin/profile"
            className="sb-profile group"
            data-active={pathname.startsWith("/admin/profile")}
            title={collapsed ? `${fullName} — profile` : undefined}
            onClick={() => setDrawerOpen(false)}
          >
            <div className="relative shrink-0">
              {avatar}
              <span className="sb-online-dot" aria-hidden />
            </div>
            <div className="sb-label sb-profile-info min-w-0 flex-1 text-left">
              <span className="sb-profile-name block truncate">{fullName}</span>
              <span className="sb-profile-meta flex items-center gap-1.5 mt-0.5">
                <span className="sb-profile-user text-muted truncate text-xs">@{username}</span>
                <span className="sb-profile-tag">Admin</span>
              </span>
            </div>
            <ChevronRight className="sb-label sb-profile-arrow h-4 w-4 shrink-0" aria-hidden />
          </Link>
          <button
            type="button"
            className="btn-signout sb-signout group"
            onClick={() => {
              setLogoutError("");
              setSignOutOpen(true);
            }}
            disabled={loggingOut}
            title={collapsed ? "Sign out" : undefined}
            aria-label="Sign out"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <LogOut className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            )}
            <span className="sb-label">{loggingOut ? "Signing out…" : "Sign out"}</span>
          </button>
          {logoutError && !signOutOpen && (
            <p className="mt-2 text-xs" style={{ color: "var(--danger)" }} role="alert">
              {logoutError}
            </p>
          )}
        </div>
      </aside>

      <div className="admin-content">
        <main className="admin-main mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</main>
        <footer className="admin-footer no-print">
          <div className="admin-footer-inner">
            <span className="admin-footer-item font-semibold text-[var(--ink)]">Authorized Staff Only</span>
            <span className="admin-footer-sep" aria-hidden>|</span>
            <span className="admin-footer-item admin-footer-address">{SCHOOL.address}</span>
            <span className="admin-footer-sep" aria-hidden>|</span>
            <span className="admin-footer-item font-semibold text-[var(--ink)]">{new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
      <PrintProgressDock />

      {signOutOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-title"
          onClick={() => {
            if (!loggingOut) setSignOutOpen(false);
          }}
        >
          <div className="modal-panel p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--field-bg)", color: "var(--danger)" }}
                aria-hidden
              >
                <LogOut className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id="signout-title" className="text-sm font-bold">
                  Sign out
                </h2>
                <p className="text-muted mt-1 text-xs leading-relaxed">
                  Are you sure you want to sign out of the administration workspace? You will need to enter your
                  credentials again to continue.
                </p>
              </div>
            </div>
            {logoutError && (
              <p className="mt-3 text-xs" style={{ color: "var(--danger)" }} role="alert">
                {logoutError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSignOutOpen(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={logout} disabled={loggingOut}>
                {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
