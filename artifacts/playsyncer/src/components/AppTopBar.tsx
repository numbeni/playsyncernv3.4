import { ThemeToggle } from "./ThemeToggle";

/**
 * Desktop-only top status/header bar.
 * Shown above page content on lg+ breakpoints.
 * Hidden completely on mobile (mobile bar lives inside AppSidebar).
 */
export function AppTopBar() {
  return (
    <div className="hidden lg:flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/50 backdrop-blur-sm px-6 z-10">
      {/* Left side — intentionally empty; page headings live inside content */}
      <div />

      {/* Right side: theme toggle + user summary */}
      <div className="flex items-center gap-3">
        <ThemeToggle />

        <div className="h-4 w-px bg-border" />

        {/* User profile summary */}
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1 hover:bg-accent transition-colors cursor-default">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg gradient-primary text-primary-foreground text-xs font-bold shadow-glow">
            م
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">مدیر سیستم</div>
            <div className="text-[10px] text-muted-foreground" dir="ltr">
              admin@playsyncer.io
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
