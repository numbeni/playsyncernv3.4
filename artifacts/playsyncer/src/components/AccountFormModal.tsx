import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account, AccountInput, AccountStatus } from "@/domain/accounts/types";
import { normalizeAccountPrefix } from "@/domain/accounts/numberPrefix";

const OPEN_ANIMATION_MS = 520;
const CLOSE_ANIMATION_MS = 260;

interface Props {
  open: boolean;
  mode: "add" | "edit";
  existingAccounts: Account[];
  /** Parent game title — used to show the default prefix preview. */
  gameTitle: string;
  initial?: Account;
  onSave: (data: AccountInput) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Basic email format check — covers the vast majority of valid addresses. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isValidEmail = (v: string) => EMAIL_RE.test(v.trim());

/**
 * Gregorian date in YYYY/MM/DD format.
 * Month: 01–12, Day: 01–31 (calendar correctness not enforced beyond range).
 */
const BIRTH_DATE_RE = /^\d{4}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/;
const isValidBirthDate = (v: string) => BIRTH_DATE_RE.test(v.trim());

/** Parse backup codes from a multiline / comma / pipe separated string. */
function parseBackupCodes(raw: string): string[] {
  return raw
    .split(/[\n,|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type FieldErrors = Partial<
  Record<
    | "email"
    | "password"
    | "emailPassword"
    | "onlineId"
    | "birthDate"
    | "familyManagementEmail"
    | "backupCodes"
    | "duplicate",
    string
  >
>;

export function AccountFormModal({
  open,
  mode,
  existingAccounts,
  gameTitle,
  initial,
  onSave,
  onClose,
}: Props) {
  const [numberPrefix, setNumberPrefix] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [onlineId, setOnlineId] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [familyManagementEmail, setFamilyManagementEmail] = useState("");
  const [backupCodesText, setBackupCodesText] = useState("");
  const [status, setStatus] = useState<AccountStatus>("active");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [entered, setEntered] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const previousBodyOverflow = useRef<string>("");
  const closeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearHandles = () => {
    if (closeTimerRef.current !== null) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (rafRef.current !== null) { window.cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const requestClose = () => {
    clearHandles();
    setEntered(false);
    closeTimerRef.current = window.setTimeout(() => { closeTimerRef.current = null; onClose(); }, CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    if (!open) return;
    clearHandles();
    setEntered(false);

    if (mode === "edit" && initial) {
      // In edit mode populate with the raw stored prefix so the admin can modify it.
      setNumberPrefix(initial.numberPrefix);
      setEmail(initial.email);
      setPassword(initial.password);
      setEmailPassword(initial.emailPassword);
      setOnlineId(initial.onlineId);
      setBirthDate(initial.birthDate);
      setFamilyManagementEmail(initial.familyManagementEmail);
      setBackupCodesText(initial.backupCodes.join("\n"));
      setStatus(initial.status);
    } else {
      setNumberPrefix("");
      setEmail("");
      setPassword("");
      setEmailPassword("");
      setOnlineId("");
      setBirthDate("");
      setFamilyManagementEmail("");
      setBackupCodesText("");
      setStatus("active");
    }

    setErrors({});

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => { setEntered(true); rafRef.current = null; });
    });

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      window.setTimeout(() => emailRef.current?.focus(), OPEN_ANIMATION_MS);
    }

    return clearHandles;
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousBodyOverflow.current; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  /** Live preview of what the account number prefix will look like. */
  const previewPrefix = normalizeAccountPrefix(numberPrefix.trim() || gameTitle);

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    const trimmedEmail = email.trim();
    const trimmedFamilyEmail = familyManagementEmail.trim();

    // Email
    if (!trimmedEmail) {
      errs.email = "ایمیل الزامی است";
    } else if (!isValidEmail(trimmedEmail)) {
      errs.email = "فرمت ایمیل صحیح نیست (مثال: example@email.com)";
    } else {
      const duplicate = existingAccounts.find(
        (a) => a.email.trim().toLowerCase() === trimmedEmail.toLowerCase() && a.id !== initial?.id,
      );
      if (duplicate) errs.duplicate = `ایمیل «${trimmedEmail}» قبلاً در این بازی ثبت شده است`;
    }

    if (!password.trim()) errs.password = "رمز عبور PlayStation الزامی است";
    if (!emailPassword.trim()) errs.emailPassword = "رمز ایمیل الزامی است";
    if (!onlineId.trim()) errs.onlineId = "Online ID الزامی است";

    // Birth Date — must be YYYY/MM/DD Gregorian
    if (!birthDate.trim()) {
      errs.birthDate = "تاریخ تولد الزامی است";
    } else if (!isValidBirthDate(birthDate)) {
      errs.birthDate = "فرمت تاریخ تولد صحیح نیست — باید YYYY/MM/DD باشد (مثال: 2001/08/27)";
    }

    // Family Management Email
    if (!trimmedFamilyEmail) {
      errs.familyManagementEmail = "Family Management Email الزامی است";
    } else if (!isValidEmail(trimmedFamilyEmail)) {
      errs.familyManagementEmail = "فرمت ایمیل صحیح نیست (مثال: family@email.com)";
    }

    const codes = parseBackupCodes(backupCodesText);
    if (codes.length === 0) errs.backupCodes = "کدهای پشتیبان الزامی هستند";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onSave({
      // Empty prefix lets the caller normalize to the game title.
      numberPrefix: numberPrefix.trim() || undefined,
      email: email.trim(),
      password: password.trim(),
      emailPassword: emailPassword.trim(),
      onlineId: onlineId.trim(),
      birthDate: birthDate.trim(),
      familyManagementEmail: familyManagementEmail.trim(),
      backupCodes: parseBackupCodes(backupCodesText),
      status,
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-form-title"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300 ease-out",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={requestClose}
      />

      {/* Panel: bottom sheet (mobile) / centered modal (desktop) */}
      <div
        className={cn(
          "relative z-[301] flex min-h-0 w-full flex-col overflow-hidden border border-border bg-card shadow-elevated",
          "max-h-[calc(100dvh-0.75rem)] rounded-t-3xl",
          "transform-gpu will-change-transform transition-[transform,opacity] duration-[520ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
          entered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          "sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl",
          entered ? "sm:translate-y-0 sm:scale-100" : "sm:translate-y-4 sm:scale-[0.98]",
        )}
        style={{ transitionDuration: entered ? `${OPEN_ANIMATION_MS}ms` : `${CLOSE_ANIMATION_MS}ms` }}
      >
        {/* Mobile drag handle */}
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <h2 id="account-form-title" className="truncate text-sm font-semibold sm:text-base">
              {mode === "add" ? "افزودن اکانت جدید" : "ویرایش اکانت"}
            </h2>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-accent transition-colors"
            aria-label="بستن"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overscroll-contain touch-pan-y space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-5 sm:py-5">
            {/* Duplicate error banner */}
            {errors.duplicate && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errors.duplicate}
              </div>
            )}

            {/* ── Optional account number prefix ────────────────── */}
            <Field
              label="Account Number Prefix"
              hint="اگر خالی بماند، نام بازی برای شماره نمایشی اکانت استفاده می‌شود."
            >
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={numberPrefix}
                  dir="ltr"
                  onChange={(e) => setNumberPrefix(e.target.value)}
                  placeholder={`مثال: GTA6، FC25، COD (پیش‌فرض: ${normalizeAccountPrefix(gameTitle)})`}
                  className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:border-primary/60 focus:ring-2 focus:ring-ring/30 sm:py-2.5"
                />
                {/* Live preview */}
                <p className="text-[11px] text-muted-foreground" dir="ltr">
                  شماره نمایشی:{" "}
                  <span className="font-mono font-medium text-primary">
                    #{previewPrefix}-001
                  </span>
                </p>
              </div>
            </Field>

            <Field label="Email" required error={errors.email}>
              <input
                ref={emailRef}
                type="email"
                value={email}
                dir="ltr"
                onChange={(e) => { setEmail(e.target.value); if (errors.email || errors.duplicate) setErrors((p) => ({ ...p, email: undefined, duplicate: undefined })); }}
                placeholder="example@playstation.com"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.email ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field label="PlayStation Password" required error={errors.password}>
              <input
                type="text"
                value={password}
                dir="ltr"
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                placeholder="PlayStation password"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.password ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field label="Email Password" required error={errors.emailPassword} hint="رمز عبور حساب ایمیل اکانت">
              <input
                type="text"
                value={emailPassword}
                dir="ltr"
                onChange={(e) => { setEmailPassword(e.target.value); if (errors.emailPassword) setErrors((p) => ({ ...p, emailPassword: undefined })); }}
                placeholder="Email password"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.emailPassword ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field label="Online ID" required error={errors.onlineId}>
              <input
                type="text"
                value={onlineId}
                dir="ltr"
                onChange={(e) => { setOnlineId(e.target.value); if (errors.onlineId) setErrors((p) => ({ ...p, onlineId: undefined })); }}
                placeholder="PSN username"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.onlineId ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field label="Birth Date" required error={errors.birthDate}>
              <input
                type="text"
                value={birthDate}
                dir="ltr"
                onChange={(e) => { setBirthDate(e.target.value); if (errors.birthDate) setErrors((p) => ({ ...p, birthDate: undefined })); }}
                placeholder="1990/01/01"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.birthDate ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field label="Family Management Email" required error={errors.familyManagementEmail}>
              <input
                type="email"
                value={familyManagementEmail}
                dir="ltr"
                onChange={(e) => { setFamilyManagementEmail(e.target.value); if (errors.familyManagementEmail) setErrors((p) => ({ ...p, familyManagementEmail: undefined })); }}
                placeholder="family@email.com"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.familyManagementEmail ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            <Field
              label="2-step verification codes"
              required
              hint="هر کد در یک خط — یا با کاما/خط عمودی جدا کنید"
              error={errors.backupCodes}
            >
              <textarea
                value={backupCodesText}
                dir="ltr"
                onChange={(e) => { setBackupCodesText(e.target.value); if (errors.backupCodes) setErrors((p) => ({ ...p, backupCodes: undefined })); }}
                placeholder={"a4f9-22\nb7c1-88\ne6d3-14"}
                rows={4}
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 resize-none",
                  errors.backupCodes ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
            </Field>

            {/* Status */}
            <Field label="وضعیت">
              <div className="grid grid-cols-2 gap-2">
                {(["active", "disabled"] as AccountStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "rounded-xl border py-3 text-center text-sm font-medium transition-all sm:py-2",
                      status === s
                        ? s === "active"
                          ? "border-success bg-success/10 text-success"
                          : "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border bg-muted/40 text-muted-foreground hover:border-muted-foreground/40",
                    )}
                  >
                    {s === "active" ? "فعال" : "غیرفعال"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Footer */}
          <div
            className={cn(
              "sticky bottom-0 z-10 grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur",
              "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
              "sm:flex sm:justify-end sm:px-5 sm:py-4 sm:pb-4",
            )}
          >
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors sm:py-2"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition-all hover:shadow-glow sm:px-5 sm:py-2"
            >
              {mode === "add" ? "افزودن اکانت" : "ذخیره تغییرات"}
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
