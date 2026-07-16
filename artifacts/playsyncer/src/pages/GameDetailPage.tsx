import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeft, Gamepad2, Loader2, AlertCircle, RefreshCw, Users, Pencil, Power } from "lucide-react";
import { SmartSearch } from "@/components/SmartSearch";
import { GameFormModal } from "@/components/GameFormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { platformLabel } from "@/domain/games/platform";
import { useGames } from "@/hooks/useGames";
import NotFoundPage from "./NotFoundPage";

const FALLBACK_COVER =
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop";

export default function GameDetailPage() {
  const { gameId } = useParams();
  const { games, isLoading, isError, error, refetch, mutations } = useGames();
  const game = games.find((g) => g.id === gameId);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    document.title = game ? `${game.title} — PlaySyncer` : "بازی — PlaySyncer";
  }, [game]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">در حال دریافت اطلاعات بازی…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-3 text-sm font-medium text-destructive">دریافت اطلاعات بازی با خطا مواجه شد</p>
          {error && <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>}
          <button
            onClick={refetch}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            تلاش مجدد
          </button>
        </div>
      </div>
    );
  }

  if (!game) return <NotFoundPage />;

  const coverUrl = game.coverUrl || FALLBACK_COVER;
  const isActive = game.status === "ACTIVE";

  const handleSave = async (data: Parameters<typeof mutations.editGame>[1]) => {
    await mutations.editGame(game.id, data);
  };

  const handleConfirmStatus = async () => {
    await mutations.toggleGameStatus(game.id);
    setConfirmOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Link to="/" className="hover:text-foreground transition-colors">
          بازی‌ها
        </Link>
        <ChevronLeft className="h-3 w-3 shrink-0" />
        <span className="text-foreground">{game.title}</span>
      </div>

      <div className="mb-6">
        <SmartSearch games={games} />
      </div>

      <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-elevated">
        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="relative aspect-[16/10] md:aspect-auto md:h-full bg-muted">
            <img
              src={coverUrl}
              alt={game.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-l from-card via-card/20 to-transparent md:from-card md:via-card/40" />
          </div>

          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2.5 py-1 text-[11px] font-semibold text-primary">
                    <Gamepad2 className="h-3 w-3" />
                    {platformLabel(game.platform)}
                  </span>
                  {game.status === "INACTIVE" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      غیرفعال
                    </span>
                  )}
                </div>
                <h1 className="mt-2 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                  {game.title}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  مدیریت اکانت‌ها، ظرفیت‌ها و تخصیص مشتریان
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <Pencil className="h-4 w-4" />
                  <span className="hidden sm:inline">ویرایش</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  className={isActive ? "inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-medium text-warning hover:bg-warning/20 transition-colors" : "inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success hover:bg-success/20 transition-colors"}
                >
                  <Power className="h-4 w-4" />
                  <span className="hidden sm:inline">{isActive ? "غیرفعال" : "فعال"}</span>
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/40 p-3">
                <div className="text-[11px] text-muted-foreground">تعداد اکانت‌ها</div>
                <div className="mt-1 text-xl font-bold tabular-nums">
                  {game.accountCount.toLocaleString("fa-IR")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-8">
        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            مدیریت اکانت‌های این بازی هنوز به Backend متصل نشده است و در فاز Account Integration فعال خواهد شد.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            تعداد اکانت‌های فعلی از backend: {game.accountCount.toLocaleString("fa-IR")}
          </p>
        </div>
      </section>

      <GameFormModal
        open={formOpen}
        mode="edit"
        initial={game}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={confirmOpen}
        title={isActive ? "غیرفعال کردن بازی" : "فعال کردن بازی"}
        description={
          isActive
            ? `آیا از غیرفعال کردن بازی «${game.title}» مطمئن هستید؟ این بازی همچنان در لیست باقی می‌ماند.`
            : `آیا از فعال کردن بازی «${game.title}» مطمئن هستید؟`
        }
        confirmLabel={isActive ? "غیرفعال کردن" : "فعال کردن"}
        confirmVariant={isActive ? "danger" : "warning"}
        onConfirm={handleConfirmStatus}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
