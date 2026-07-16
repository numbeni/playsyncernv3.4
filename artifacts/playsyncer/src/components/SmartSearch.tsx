import { useNavigate } from "react-router-dom";
import { Search, Gamepad2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/domain/search/types";
import { runSmartSearch } from "@/domain/search/smartSearch";
import type { Game } from "@/domain/games/types";

interface Props {
  /** Callback to filter game cards by a simple query (game title). */
  onGameFilter?: (query: string) => void;
  /** Live games list. */
  games?: Game[];
  className?: string;
}

export function SmartSearch({ onGameFilter, games = [], className }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    onGameFilter?.(q);
  }, [q, onGameFilter]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const hits = runSmartSearch(games, q);
  const gameHits = hits.filter((h) => h.kind === "game");

  const go = (hit: SearchHit) => {
    setOpen(false);
    setQ("");
    const highlight = hit.accountId ? `?highlight=${encodeURIComponent(hit.accountId)}` : "";
    navigate(`/games/${hit.gameId}${highlight}`);
  };

  return (
    <div ref={boxRef} className={cn("relative w-full", className)}>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-soft transition-all",
          open && "shadow-elevated ring-2 ring-ring/30 border-primary/50",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="جستجو در بازی‌ها بر اساس عنوان یا شناسه…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {q && (
          <button
            onClick={() => { setQ(""); inputRef.current?.focus(); }}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            aria-label="پاک کردن"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground select-none">
          ⌘K
        </kbd>
      </div>

      {open && q && (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-popover shadow-elevated">
          {hits.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              نتیجه‌ای برای «{q}» پیدا نشد
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto py-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                بازی‌ها
              </div>
              {gameHits.map((h, i) => (
                <button
                  key={`game-${i}`}
                  onClick={() => go(h)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-right hover:bg-accent"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg gradient-primary text-primary-foreground">
                    <Gamepad2 className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {h.sublabel}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    بازی
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
