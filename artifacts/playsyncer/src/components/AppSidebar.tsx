import { Link, useLocation } from "react-router-dom";
import {
  Gamepad2,
  LayoutGrid,
  ShoppingCart,
  AlertOctagon,
  Users,
  Settings,
  Menu,
  X,
  ChevronsRight,
  ChevronsLeft,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useSidebar } from "@/hooks/useSidebar";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const nav: NavItem[] = [
  { to: "/", label: "بازی‌ها", icon: LayoutGrid },
  { to: "/orders", label: "سفارشات", icon: ShoppingCart, badge: "به‌زودی" },
  { to: "/issues", label: "گزارش مشکلات", icon: AlertOctagon, badge: "به‌زودی" },
  { to: "/staff", label: "کاربران و دسترسی", icon: Users, badge: "به‌زودی" },
  { to: "/settings", label: "تنظیمات", icon: Settings },
];

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();
  const { pathname } = useLocation();

  const isActive = (to: string) =>
    to === "/" ? pathname === "/" || pathname.startsWith("/games") : pathname.startsWith(to);

  return (
    <>
      {/* ── Mobile top bar ───────────────────────────────────────── */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur px-4 h-14">
        <BrandMark />
        <div className="flex items-center gap-2">
          {/* Theme toggle stays in mobile bar — not duplicated on desktop */}
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent hover:border-primary/60"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* ── Mobile overlay ───────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-background/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar panel ────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 z-50 h-dvh shrink-0 border-l border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-col right-0",
          "transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform",
          collapsed ? "lg:w-20" : "lg:w-72",
          "w-72",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
        )}
      >
        {/* ── Sidebar header ─────────────────────────────────────── */}
        {/*
            Desktop: [BrandMark ··· collapse-btn] when expanded
                     [collapse-btn] centered when collapsed
            Mobile:  [BrandMark] only (mobile top bar handles the rest)
        */}
        <div
          className={cn(
            "h-16 border-b border-sidebar-border flex items-center gap-2 shrink-0",
            collapsed ? "lg:justify-center lg:px-3 px-5 justify-between" : "px-5 justify-between",
          )}
        >
          {/* Brand — hidden on desktop when collapsed (icon takes its place) */}
          {!collapsed && <BrandMark />}

          {/* Collapsed desktop: game icon as home link */}
          {collapsed && (
            <Link
              to="/"
              className="hidden lg:grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow"
              aria-label="PlaySyncer"
            >
              <Gamepad2 className="h-5 w-5" />
            </Link>
          )}

          {/* Mobile still shows the brand when collapsed state changes (mobile ignores collapsed) */}
          {collapsed && (
            <div className="lg:hidden">
              <BrandMark />
            </div>
          )}

          {/* Desktop collapse toggle — clean icon button in the header */}
          <button
            onClick={toggle}
            aria-label={collapsed ? "باز کردن نوار کناری" : "بستن نوار کناری"}
            title={collapsed ? "باز کردن" : "بستن"}
            className="hidden lg:grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all border border-transparent hover:border-sidebar-border"
          >
            {collapsed ? (
              <ChevronsLeft className="h-4 w-4" />
            ) : (
              <ChevronsRight className="h-4 w-4" />
            )}
          </button>

          {/* Mobile close button (only when sidebar drawer is open) */}
          <button
            className="lg:hidden grid h-8 w-8 place-items-center rounded-lg text-sidebar-foreground/60 hover:bg-sidebar-accent transition-colors"
            onClick={() => setMobileOpen(false)}
            aria-label="بستن منو"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Navigation ─────────────────────────────────────────── */}
        <nav className={cn("flex-1 overflow-y-auto space-y-1", collapsed ? "lg:p-2 p-3" : "p-3")}>
          {!collapsed && (
            <div className="px-2 pt-2 pb-3 text-[11px] font-medium uppercase tracking-widest text-sidebar-foreground/50">
              مدیریت
            </div>
          )}
          {collapsed && <div className="hidden lg:block h-2" />}
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "group flex items-center rounded-xl text-sm font-medium transition-all",
                  collapsed
                    ? "lg:justify-center lg:px-0 lg:py-2 gap-3 px-3 py-2.5"
                    : "gap-3 px-3 py-2.5",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-glow"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-all",
                    active
                      ? "gradient-primary text-primary-foreground shadow-glow"
                      : "bg-sidebar-accent/60 text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    collapsed && "lg:hidden",
                  )}
                >
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    className={cn(
                      "shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
                      collapsed && "lg:hidden",
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── Footer / User — mobile only ────────────────────────── */}
        {/*
            Desktop: user profile is shown in AppTopBar — no duplicate here.
            Mobile: still show the user card at the bottom of the drawer.
        */}
        <div className={cn("border-t border-sidebar-border p-3 lg:hidden")}>
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 border border-border p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg gradient-primary text-primary-foreground text-sm font-bold shadow-glow">
              م
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">مدیر سیستم</div>
              <div className="truncate text-xs text-sidebar-foreground/60" dir="ltr">
                admin@playsyncer.io
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function BrandMark() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <div className="relative grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
        <Gamepad2 className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">PlaySyncer</div>
        <div className="text-[10px] text-muted-foreground">پنل مدیریت</div>
      </div>
    </Link>
  );
}
