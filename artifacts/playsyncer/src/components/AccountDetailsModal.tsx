import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Key,
  UserCircle2,
  Calendar,
  Users,
  ShieldCheck,
  Eye,
  EyeOff,
  Copy,
  Check,
  Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/domain/accounts/types";
import type { Platform } from "@/domain/games/types";
import { platformLabel } from "@/domain/games/platform";

interface Props {
  open: boolean;
  account: Account | null;
  gamePlatform: Platform;
  onClose: () => void;
}

export function AccountDetailsModal({ open, account, gamePlatform, onClose }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setShowPassword(false);
    setShowEmailPassword(false);
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !account || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[300] overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-details-title"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="flex min-h-full justify-center p-4 sm:p-6">
        <div className="relative z-10 my-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-elevated animate-slide-up">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow font-bold text-sm">
                {account.number.slice(-3)}
              </div>
              <div className="min-w-0">
                <h2 id="account-details-title" className="truncate text-sm font-semibold sm:text-base">
                  {account.number}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {platformLabel(gamePlatform)} · {account.status === "active" ? "فعال" : "غیرفعال"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-accent transition-colors"
              aria-label="بستن"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-2 p-4 sm:p-5 overflow-y-auto max-h-[calc(100dvh-10rem)]">
            <DetailRow icon={Hash} label="Account ID" value={account.accountCode} copy dir="ltr" />
            <DetailRow icon={Mail} label="Email" value={account.email} copy dir="ltr" />

            <DetailRow
              icon={Key}
              label="PlayStation Password"
              value={showPassword ? account.password : "•".repeat(Math.min(account.password.length, 16))}
              copyValue={account.password}
              copy
              dir="ltr"
              trailing={
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label={showPassword ? "مخفی کردن" : "نمایش"}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
            />

            <DetailRow
              icon={Key}
              label="Email Password"
              value={showEmailPassword ? account.emailPassword : "•".repeat(Math.min(account.emailPassword.length || 6, 16))}
              copyValue={account.emailPassword}
              copy
              dir="ltr"
              trailing={
                <button
                  onClick={() => setShowEmailPassword((v) => !v)}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label={showEmailPassword ? "مخفی کردن" : "نمایش"}
                >
                  {showEmailPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              }
            />

            <DetailRow icon={UserCircle2} label="Online ID" value={account.onlineId || "—"} copy dir="ltr" />
            <DetailRow icon={Calendar} label="Birth Date" value={account.birthDate || "—"} dir="ltr" />
            <DetailRow icon={Users} label="Family Management" value={account.familyManagementEmail || "—"} copy dir="ltr" />

            {/* Backup codes */}
            <div className="rounded-xl border border-border bg-card px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] text-muted-foreground">Backup Codes</span>
                  {account.backupCodes.length === 0 ? (
                    <span className="block text-xs text-muted-foreground">—</span>
                  ) : (
                    <ul className="mt-1 space-y-0.5">
                      {account.backupCodes.map((code, i) => (
                        <li key={i} className="font-mono text-xs" dir="ltr">
                          {code}
                        </li>
                      ))}
                    </ul>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-3 sm:px-5 sm:py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              بستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
      aria-label="کپی"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  copyValue,
  copy,
  dir: textDir = "rtl",
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copyValue?: string;
  copy?: boolean;
  dir?: "ltr" | "rtl";
  trailing?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <span className={cn("block truncate font-mono text-xs")} dir={textDir}>
          {value}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {copy && <CopyButton value={copyValue ?? value} />}
        {trailing}
      </span>
    </div>
  );
}
