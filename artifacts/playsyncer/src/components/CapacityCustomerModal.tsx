import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SlotCustomer, CustomerInput } from "@/domain/slots/types";
import { normalizeOrderId, isValidOrderId } from "@/domain/slots/normalizeOrderId";

const OPEN_MS = 400;
const CLOSE_MS = 220;

interface Props {
  open: boolean;
  mode: "add" | "edit";
  slotLabel: string;
  initial?: SlotCustomer;
  onSave: (data: CustomerInput) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Accept Iranian mobile: 09xxxxxxxxx (11 digits) or +989xxxxxxxxx (13 chars).
 * Lenient fallback: any non-empty string also passes after a warning-free path.
 */
const PHONE_RE = /^(09\d{9}|\+989\d{9})$/;
const isValidPhone = (v: string) => PHONE_RE.test(v.trim());

type FieldErrors = Partial<Record<"phone" | "orderId", string>>;

export function CapacityCustomerModal({
  open,
  mode,
  slotLabel,
  initial,
  onSave,
  onClose,
}: Props) {
  const [phone, setPhone] = useState("");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [entered, setEntered] = useState(false);

  const phoneRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const clearHandles = () => {
    if (closeTimerRef.current !== null) { window.clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (rafRef.current !== null) { window.cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  };

  const requestClose = () => {
    clearHandles();
    setEntered(false);
    closeTimerRef.current = window.setTimeout(() => { closeTimerRef.current = null; onClose(); }, CLOSE_MS);
  };

  useEffect(() => {
    if (!open) return;
    clearHandles();
    setEntered(false);
    setErrors({});

    if (mode === "edit" && initial) {
      setPhone(initial.phone);
      setOrderId(initial.orderId);
      setNote(initial.note ?? "");
    } else {
      setPhone("");
      setOrderId("");
      setNote("");
    }

    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = window.requestAnimationFrame(() => { setEntered(true); rafRef.current = null; });
    });

    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      window.setTimeout(() => phoneRef.current?.focus(), OPEN_MS);
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    const trimmedPhone = phone.trim();
    const trimmedOrderId = orderId.trim();

    if (!trimmedPhone) {
      errs.phone = "شماره تلفن الزامی است";
    } else if (!isValidPhone(trimmedPhone)) {
      errs.phone = "فرمت شماره صحیح نیست — مثال: 09121234567 یا +989121234567";
    }

    if (!trimmedOrderId) {
      errs.orderId = "شناسه سفارش الزامی است";
    } else {
      const normalized = normalizeOrderId(trimmedOrderId);
      if (!isValidOrderId(normalized)) {
        errs.orderId = "شناسه سفارش نامعتبر است — مثال: ORD-200 یا فقط عدد مثل 200";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      phone: phone.trim(),
      orderId: normalizeOrderId(orderId.trim()),
      note: note.trim() || undefined,
    });
  };

  const modal = (
    <div
      className="fixed inset-0 z-[400] flex items-end justify-center overflow-hidden sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cap-customer-title"
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200",
          entered ? "opacity-100" : "opacity-0",
        )}
        onClick={requestClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "relative z-[401] flex min-h-0 w-full flex-col overflow-hidden border border-border bg-card shadow-elevated",
          "max-h-[calc(100dvh-0.75rem)] rounded-t-3xl",
          "transform-gpu will-change-transform transition-[transform,opacity]",
          entered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
          "sm:w-[calc(100vw-2rem)] sm:max-w-md sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl",
          entered ? "sm:translate-y-0 sm:scale-100" : "sm:translate-y-4 sm:scale-[0.98]",
        )}
        style={{ transitionDuration: entered ? `${OPEN_MS}ms` : `${CLOSE_MS}ms` }}
      >
        {/* Mobile drag handle */}
        <div className="flex shrink-0 justify-center pt-2 sm:hidden">
          <div className="h-1 w-11 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id="cap-customer-title" className="truncate text-sm font-semibold sm:text-base">
                {mode === "add" ? "افزودن مشتری" : "ویرایش مشتری"}
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">{slotLabel}</p>
            </div>
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
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain space-y-4 px-4 py-4 sm:px-5 sm:py-5">

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                شماره تلفن
                <span className="mr-1 text-destructive">*</span>
              </label>
              <input
                ref={phoneRef}
                type="tel"
                value={phone}
                dir="ltr"
                onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
                placeholder="09121234567"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.phone ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
              {errors.phone && <p className="text-[11px] text-destructive">{errors.phone}</p>}
            </div>

            {/* Order ID */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                شناسه سفارش
                <span className="mr-1 text-destructive">*</span>
              </label>
              <input
                type="text"
                value={orderId}
                dir="ltr"
                onChange={(e) => { setOrderId(e.target.value); if (errors.orderId) setErrors((p) => ({ ...p, orderId: undefined })); }}
                placeholder="ORD-10000"
                className={cn(
                  "w-full rounded-xl border bg-muted/40 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:ring-2 focus:ring-ring/30 sm:py-2.5",
                  errors.orderId ? "border-destructive focus:ring-destructive/30" : "border-border focus:border-primary/60",
                )}
              />
              {errors.orderId && <p className="text-[11px] text-destructive">{errors.orderId}</p>}
            </div>

            {/* Note (optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                یادداشت
                <span className="mr-1.5 text-[10px] font-normal text-muted-foreground/60">(اختیاری)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="یادداشت اختیاری برای این تخصیص..."
                rows={2}
                className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60 transition-all focus:border-primary/60 focus:ring-2 focus:ring-ring/30 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className={cn(
            "sticky bottom-0 z-10 grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur",
            "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
            "sm:flex sm:justify-end sm:px-5 sm:py-4 sm:pb-4",
          )}>
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
              {mode === "add" ? "افزودن مشتری" : "ذخیره تغییرات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
