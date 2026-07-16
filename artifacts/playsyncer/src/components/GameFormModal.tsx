import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Gamepad2, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game } from "@/domain/games/types";
import type { GameFormData } from "@/hooks/useGames";

interface Props {
  open: boolean;
  mode: "add" | "edit";
  initial?: Game;
  onSave: (data: GameFormData) => Promise<void>;
  onClose: () => void;
}

const PLATFORMS: { value: GameFormData["platform"]; label: string; desc: string }[] = [
  { value: "PS5_ONLY", label: "PS5 Only", desc: "فقط برای PlayStation 5" },
  { value: "PS4_AND_PS5", label: "PS4 + PS5", desc: "پشتیبانی از هر دو نسل" },
  { value: "PS4_ONLY", label: "PS4 Only", desc: "فقط برای PlayStation 4" },
];

const STATUSES: { value: GameFormData["status"]; label: string }[] = [
  { value: "ACTIVE", label: "فعال" },
  { value: "INACTIVE", label: "غیرفعال" },
];

const OPEN_ANIMATION_MS = 520;
const CLOSE_ANIMATION_MS = 260;

export function GameFormModal({ open, mode, initial, onSave, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [platform, setPlatform] = useState<GameFormData["platform"]>("PS5_ONLY");
  const [status, setStatus] = useState<GameFormData["status"]>("ACTIVE");
  const [errors, setErrors] = useState<
    Partial<Record<"title" | "platform", string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [entered, setEntered] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const previousBodyOverflow = useRef<string>("");
  const closeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  // Synchronous lock — set before any setState or await so rapid clicks
  // cannot fire a second submission even if React batches state updates.
  const submittingRef = useRef(false);

  const platformLocked = mode === "edit" && (initial?.accountCount ?? 0) > 0;

  const clearAnimationHandles = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const requestClose = () => {
    clearAnimationHandles();
    setEntered(false);

    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    if (!open) return;

    clearAnimationHandles();
    setEntered(false);
    setIsSubmitting(false);
    setSubmitError(null);
    submittingRef.current = false;

    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setCoverUrl(initial.coverUrl ?? "");
      setPlatform(initial.platform);
      setStatus(initial.status);
    } else {
      setTitle("");
      setCoverUrl("");
      setPlatform("PS5_ONLY");
      setStatus("ACTIVE");
    }

    setErrors({});

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => {
        setEntered(true);
        rafRef.current = null;
      });
    });

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 640px)").matches
    ) {
      window.setTimeout(() => titleRef.current?.focus(), OPEN_ANIMATION_MS);
    }

    return clearAnimationHandles;
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submittingRef.current) requestClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, isSubmitting]);

  useEffect(() => {
    if (!open) return;

    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow.current;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const validate = (): boolean => {
    const errs: typeof errors = {};

    if (!title.trim()) errs.title = "عنوان بازی الزامی است";
    if (!platform) errs.platform = "پلتفرم الزامی است";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Check the synchronous ref first — state updates are asynchronous and a
    // rapid double-click can reach here before isSubmitting becomes true.
    if (!validate() || submittingRef.current) return;
    submittingRef.current = true; // synchronous guard before any setState / await

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSave({
        title: title.trim(),
        coverUrl: coverUrl.trim(),
        platform,
        status,
      });
      // Keep the submit lock (both ref and state) active during the close
      // animation so the user cannot fire another request while sliding out.
      requestClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "عملیات با خطا مواجه شد";
      setSubmitError(message);
      // Unlock on failure so the user can retry.
      setIsSubmitting(false);
      submittingRef.current = false;
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-form-title"
    >
      <div
        className={cn(
          "absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={submittingRef.current ? undefined : requestClose}
      />

      <div
        className={cn(
          "relative z-[301] flex min-h-0 w-full flex-col overflow-hidden border border-border bg-card shadow-elevated",
          "max-h-[calc(100dvh-0.75rem)] rounded-t-3xl",
          "transform-gpu will-change-transform transition-[transform,opacity] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          entered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          "sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl",
          entered
            ? "sm:translate-y-0 sm:scale-100"
            : "sm:translate-y-4 sm:scale-[0.98]",
        )}
        style={{
          transitionDuration: entered
            ? `${OPEN_ANIMATION_MS}ms`
            : `${CLOSE_ANIMATION_MS}ms`,
        }}
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Gamepad2 className="h-4 w-4" />
            </div>
            <h2
              id="game-form-title"
              className="truncate text-sm font-semibold sm:text-base"
            >
              {mode === "add" ? "افزودن بازی جدید" : "ویرایش بازی"}
            </h2>
          </div>

          <button
            type="button"
            onClick={submittingRef.current ? undefined : requestClose}
            disabled={isSubmitting}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overscroll-contain touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
            <Field label="عنوان بازی" required error={errors.title}>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (errors.title)
                    setErrors((prev) => ({ ...prev, title: undefined }));
                }}
                disabled={isSubmitting}
                placeholder="مثال: GTA VI"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5 disabled:opacity-60",
                  errors.title
                    ? "border-destructive focus:ring-destructive/30"
                    : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field
              label="آدرس تصویر (اختیاری)"
              hint="در صورت خالی بودن، تصویر پیش‌فرض نمایش داده می‌شود، اما در پایگاه داده ذخیره نمی‌شود"
            >
              <div className="relative">
                <ImageIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  type="url"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="https://…"
                  dir="ltr"
                  className="w-full rounded-xl border border-border bg-muted/40 py-3 pr-10 pl-4 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:border-primary/60 focus:ring-2 focus:ring-ring/30 sm:py-2.5 disabled:opacity-60"
                />
              </div>

              {coverUrl && (
                <div className="mt-2 h-24 overflow-hidden rounded-xl border border-border bg-muted sm:h-28">
                  <img
                    src={coverUrl}
                    alt="پیش‌نمایش"
                    className="h-full w-full object-cover"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
              )}
            </Field>

            <Field label="پلتفرم" required error={errors.platform}>
              {platformLocked && (
                <p className="mb-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                  پس از ثبت اکانت، امکان تغییر پلتفرم وجود ندارد.
                </p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    disabled={isSubmitting || platformLocked}
                    onClick={() => {
                      setPlatform(p.value);
                      if (errors.platform)
                        setErrors((prev) => ({
                          ...prev,
                          platform: undefined,
                        }));
                    }}
                    className={cn(
                      "rounded-xl border p-3 text-right transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                      platform === p.value
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-muted/40 hover:border-primary/40",
                    )}
                  >
                    <div className="text-sm font-semibold">{p.label}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {p.desc}
                    </div>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="وضعیت">
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setStatus(s.value)}
                    className={cn(
                      "rounded-xl border py-3 text-center text-sm font-medium transition-all sm:py-2 disabled:opacity-60 disabled:cursor-not-allowed",
                      status === s.value
                        ? s.value === "ACTIVE"
                          ? "border-success bg-success/10 text-success"
                          : "border-muted-foreground/40 bg-muted text-muted-foreground"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </Field>

            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {submitError}
              </div>
            )}
          </div>

          <div
            className={cn(
              "sticky bottom-0 z-10 grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur",
              "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              "sm:flex sm:justify-end sm:px-5 sm:py-4 sm:pb-4",
            )}
          >
            <button
              type="button"
              onClick={submittingRef.current ? undefined : requestClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:py-2"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow disabled:opacity-60 disabled:cursor-not-allowed sm:px-5 sm:py-2"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "add" ? "افزودن بازی" : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="mr-1 text-destructive">*</span>}
      </label>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {children}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
