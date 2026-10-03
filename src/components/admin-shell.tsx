"use client";

import {
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
import ThemeToggle from "@/components/theme-toggle";

const NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/applications", label: "Applications", exact: false },
  { href: "/admin/print", label: "Batch Print", exact: false },
  { href: "/admin/template", label: "ID Template", exact: false },
  { href: "/admin/qr", label: "QR Codes", exact: false },
  { href: "/admin/notifications", label: "Notifications", exact: false },
  { href: "/admin/audit", label: "Audit Trail", exact: false },
];

export default function AdminShell({
  fullName,
  username,
  avatarDataUrl,
  csrfToken,
  children,
}: {
  fullName: string;
  username: string;
  avatarDataUrl: string | null;
  csrfToken: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const workspaceMenu = useRef<HTMLDivElement>(null);

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
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active}
            className="admin-nav-link"
            aria-current={active ? "page" : undefined}
          >
            {item.label}
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
            <div className="admin-brand-mark" aria-hidden>SJ</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">{SCHOOL.name}</p>
              <p className="text-muted truncate text-[11px]">Student ID Issuance · Administration</p>
            </div>
          </div>
          <div className="admin-workspace-menu no-print" ref={workspaceMenu}>
            <div className="admin-workspace-panel" id="admin-workspace-panel" hidden={!workspaceMenuOpen}>
              <p className="text-muted px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                Administration workspace
              </p>
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
                    <span className="admin-workspace-context-value">{SCHOOL.location}</span>
                  </span>
                </div>
              </div>
              <Link
                href="/admin/profile"
                className="admin-workspace-profile"
                onClick={() => setWorkspaceMenuOpen(false)}
              >
                <span className="admin-user-icon flex h-9 w-9 shrink-0 overflow-hidden">
                  {avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarDataUrl} alt="" className="h-full w-full object-cover" />
                  ) : fullName.trim().charAt(0).toUpperCase() || <UserRound className="h-4 w-4" aria-hidden />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{fullName}</span>
                  <span className="text-muted block truncate text-[10px]">Profile · @{username}</span>
                </span>
              </Link>
              <div className="admin-workspace-action">
                <span className="text-xs font-medium">Appearance</span>
                <ThemeToggle />
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-2 w-full"
                onClick={logout}
                disabled={loggingOut}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
              {logoutError && <p className="mt-2 text-xs text-red-700" role="alert">{logoutError}</p>}
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
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
