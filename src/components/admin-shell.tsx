"use client";

import {
  Bell,
  Inbox,
  LogOut,
  MapPin,
  SlidersHorizontal,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SCHOOL } from "@/lib/config";
import DisplayPreferences, { WorkspaceSection } from "@/components/display-preferences";
import SjaaLogo from "@/components/sjaa-logo";
import ManilaClock from "@/components/manila-clock";
import PrintProgressDock from "@/components/print-progress/print-progress-dock";
import type { UnreadCounts, UnreadSection } from "@/lib/unread";

const NAV: { href: string; label: string; exact: boolean; unread?: UnreadSection }[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/applications", label: "Applications", exact: false, unread: "applications" },
  { href: "/admin/print", label: "Batch Print", exact: false },
  { href: "/admin/template", label: "ID Template", exact: false },
  { href: "/admin/qr", label: "QR Codes", exact: false },
  { href: "/admin/notifications", label: "Notifications", exact: false, unread: "notifications" },
  { href: "/admin/audit", label: "Audit Trail", exact: false },
];

const UNREAD_POLL_MS = 4_000;

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
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenu = useRef<HTMLDivElement>(null);
  const [unread, setUnread] = useState<UnreadCounts>(initialUnread);
  const activeSection = NAV.find((item) => item.unread && pathname.startsWith(item.href))?.unread ?? null;

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

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    function dismissMenu(event: MouseEvent) {
      if (event.target instanceof Node && !workspaceMenu.current?.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setWorkspaceMenuOpen(false);
    }
    document.addEventListener("mousedown", dismissMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", dismissMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [workspaceMenuOpen]);

  async function logout() {
    if (loggingOut || !window.confirm("Are you sure you want to sign out of the administration workspace?")) return;
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
      router.replace("/admin/login");
      router.refresh();
      setWorkspaceMenuOpen(false);
    } catch {
      setLogoutError("Connection problem while signing out. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  const nav = (
    <nav className="admin-nav" aria-label="Administration">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const count = item.unread ? unread[item.unread] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            className="admin-nav-link"
            aria-current={active ? "page" : undefined}
          >
            {item.unread === "applications" && <Inbox className="h-3.5 w-3.5" aria-hidden />}
            {item.unread === "notifications" && <Bell className="h-3.5 w-3.5" aria-hidden />}
            {item.label}
            {count > 0 && (
              <span className="nav-badge" aria-label={`${count} new`}>
                {badgeText(count)}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <div className="admin-masthead no-print">
        <header className="admin-header relative mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 flex-1 basis-[280px] items-center gap-3">
            <SjaaLogo className="admin-brand-mark object-contain" priority />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">{SCHOOL.name}</p>
              <p className="text-muted truncate text-[11px]">Student ID Issuance · Administration</p>
              <p className="text-muted truncate text-[11px]">{SCHOOL.address}</p>
            </div>
          </div>
          <ManilaClock />
          <div className="admin-workspace-menu no-print" ref={workspaceMenu}>
            <div className="admin-workspace-panel" id="admin-workspace-panel" hidden={!workspaceMenuOpen}>
              <Link
                href="/admin/profile"
                className="admin-workspace-profile"
                onClick={() => setWorkspaceMenuOpen(false)}
              >
                <span className="admin-user-icon admin-profile-avatar flex shrink-0 overflow-hidden">
                  {avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : fullName.trim().charAt(0).toUpperCase() || <UserRound className="h-6 w-6" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{fullName}</span>
                  <span className="text-muted block truncate text-xs">@{username}</span>
                  <span className="admin-profile-link">View and edit profile</span>
                </span>
              </Link>
              <div className="ws-groups">
                <WorkspaceSection title="Workspace info" icon={<ShieldCheck className="h-4 w-4" aria-hidden />} summary="Access · location">
                  <div className="admin-workspace-context">
                    <div className="admin-workspace-context-item">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" aria-hidden />
                      <span>
                        <span className="admin-workspace-context-label">Access</span>
                        <span className="admin-workspace-context-value">Authorized staff</span>
                      </span>
                    </div>
                    <div className="admin-workspace-context-item">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        <span className="admin-workspace-context-label">School location</span>
                        <span className="admin-workspace-context-value">{SCHOOL.address}</span>
                      </span>
                    </div>
                  </div>
                </WorkspaceSection>
                <DisplayPreferences />
              </div>
              <button
                type="button"
                className="btn-signout"
                onClick={logout}
                disabled={loggingOut}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
              {logoutError && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }} role="alert">{logoutError}</p>}
            </div>
            <button
              type="button"
              className="admin-workspace-trigger"
              onClick={() => setWorkspaceMenuOpen((open) => !open)}
              aria-expanded={workspaceMenuOpen}
              aria-controls="admin-workspace-panel"
              aria-label={workspaceMenuOpen ? "Close workspace menu" : "Open workspace menu"}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              <span>Workspace</span>
            </button>
          </div>
        </header>
        <div className="admin-nav-wrap">
          <div className="mx-auto max-w-7xl px-2 sm:px-6">{nav}</div>
        </div>
      </div>
      <main className="admin-main mx-auto w-full max-w-7xl px-4 sm:px-6">{children}</main>
      <PrintProgressDock />
    </div>
  );
}
