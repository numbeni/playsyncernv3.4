import { useEffect, useMemo, useState } from "react";
import { RefreshCw, AlertCircle, Loader2, Plus } from "lucide-react";
import { SmartSearch } from "@/components/SmartSearch";
import { GameCard } from "@/components/GameCard";
import { GameFormModal } from "@/components/GameFormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useGames } from "@/hooks/useGames";
import type { Game } from "@/domain/games/types";

export default function GamesPage() {
  const { games, isLoading, isError, error, refetch, mutations } = useGames();
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingGame, setEditingGame] = useState<Game | undefined>(undefined);
  const [confirmGame, setConfirmGame] = useState<Game | null>(null);

  // Delete flow: two separate dialogs depending on accountCount.
  // deleteTarget drives both; hasAccountsDialogOpen shows the "info only" dialog.
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [hasAccountsDialogOpen, setHasAccountsDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    document.title = "بازی‌ها — PlaySyncer";
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) => g.title.toLowerCase().includes(q) || g.id.toLowerCase().includes(q),
    );
  }, [query, games]);

  const totals = useMemo(() => {
    return games.reduce(
      (acc, g) => {
        acc.games += 1;
        acc.accounts += g.accountCount;
        return acc;
      },
      { games: 0, accounts: 0 },
    );
  }, [games]);

  const openAdd = () => {
    setFormMode("add");
    setEditingGame(undefined);
    setFormOpen(true);
  };

  const openEdit = (game: Game) => {
    setFormMode("edit");
    setEditingGame(game);
    setFormOpen(true);
  };

  const openStatusConfirm = (game: Game) => {
    setConfirmGame(game);
  };

  const openDeleteDialog = (game: Game) => {
    setDeleteTarget(game);
    if (game.accountCount > 0) {
      setHasAccountsDialogOpen(true);
    } else {
      setDeleteConfirmOpen(true);
    }
  };

  const handleSave = async (data: Parameters<typeof mutations.addGame>[0]) => {
    if (formMode === "add") {
      await mutations.addGame(data);
    } else if (editingGame) {
      await mutations.editGame(editingGame.id, data);
    }
  };

  const handleConfirmStatus = async () => {
    if (!confirmGame) return;
    await mutations.toggleGameStatus(confirmGame.id);
    setConfirmGame(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    // The hook's deleteGame already uses formatApiError with { operation: "delete" }
    // so thrown errors are already Persian-safe when caught by ConfirmDialog.
    await mutations.deleteGame(deleteTarget.id);
    // On success: list refetch has already completed inside deleteGame.
    // Close the dialog.
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">داشبورد</div>
          <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">
            بازی‌ها
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            مدیریت بازی‌ها و اکانت‌های PlayStation
          </p>
        </div>

        <button
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft hover:shadow-glow transition-all"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">افزودن بازی</span>
          <span className="sm:hidden">بازی جدید</span>
        </button>
      </header>

      {/* SmartSearch — top of content, above stats */}
      <section className="mt-6">
        <SmartSearch onGameFilter={setQuery} games={games} />
      </section>

      {/* Overview stats — backend-backed metrics only. */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <OverviewStat label="کل بازی‌ها" value={totals.games} accent="primary" />
        <OverviewStat label="کل اکانت‌ها" value={totals.accounts} />
      </section>

      {/* Game grid */}
      <section className="mt-8">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState hasQuery={Boolean(query)} query={query} />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                onEdit={openEdit}
                onToggleStatus={openStatusConfirm}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>
        )}
      </section>

      <GameFormModal
        open={formOpen}
        mode={formMode}
        initial={editingGame}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      {/* Status toggle confirmation */}
      <ConfirmDialog
        open={confirmGame !== null}
        title={confirmGame?.status === "ACTIVE" ? "غیرفعال کردن بازی" : "فعال کردن بازی"}
        description={
          confirmGame?.status === "ACTIVE"
            ? `آیا از غیرفعال کردن بازی «${confirmGame?.title}» مطمئن هستید؟ این بازی همچنان در لیست باقی می‌ماند.`
            : `آیا از فعال کردن بازی «${confirmGame?.title}» مطمئن هستید؟`
        }
        confirmLabel={confirmGame?.status === "ACTIVE" ? "غیرفعال کردن" : "فعال کردن"}
        confirmVariant={confirmGame?.status === "ACTIVE" ? "danger" : "warning"}
        onConfirm={handleConfirmStatus}
        onCancel={() => setConfirmGame(null)}
      />

      {/* Delete — info dialog when game has accounts (frontend guard, no API call) */}
      <ConfirmDialog
        open={hasAccountsDialogOpen}
        title="حذف امکان‌پذیر نیست"
        description={
          deleteTarget
            ? "این بازی سابقه اکانت دارد و قابل حذف نیست. برای حفظ سوابق، بازی را غیرفعال کنید."
            : "این بازی سابقه اکانت دارد و قابل حذف نیست. برای حفظ سوابق، بازی را غیرفعال کنید."
        }
        confirmLabel="متوجه شدم"
        confirmVariant="warning"
        onConfirm={() => {
          setHasAccountsDialogOpen(false);
          setDeleteTarget(null);
        }}
        onCancel={() => {
          setHasAccountsDialogOpen(false);
          setDeleteTarget(null);
        }}
      />

      {/* Delete — destructive confirm when game has no accounts */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="حذف دائمی بازی"
        description={
          deleteTarget
            ? `آیا از حذف دائمی بازی «${deleteTarget.title}» مطمئن هستید؟ این عملیات قابل بازگشت نیست.`
            : "آیا از حذف این بازی مطمئن هستید؟"
        }
        confirmLabel="حذف بازی"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}

function OverviewStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "primary" | "success";
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div
        className={
          "mt-1.5 text-2xl font-bold tabular-nums " +
          (accent === "primary"
            ? "text-primary"
            : accent === "success"
              ? "text-success"
              : "text-foreground")
        }
      >
        {value.toLocaleString("fa-IR")}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center">
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      <p className="mt-4 text-sm text-muted-foreground">در حال دریافت بازی‌ها…</p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 text-sm font-medium text-destructive">دریافت بازی‌ها با خطا مواجه شد</p>
      {error && <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>}
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        تلاش مجدد
      </button>
    </div>
  );
}

function EmptyState({ hasQuery, query }: { hasQuery: boolean; query: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="text-sm text-muted-foreground">
        {hasQuery
          ? `بازی‌ای با «${query}» پیدا نشد.`
          : "هیچ بازی‌ای وجود ندارد. برای افزودن بازی جدید از دکمه بالا استفاده کنید."}
      </p>
    </div>
  );
}
