import { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  Key,
  Mail,
  ShieldCheck,
  Users,
  Layers,
  Check,
  Pencil,
  Trash2,
  PowerOff,
  Power,
  MoreVertical,
  Plus,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/domain/accounts/types";
import { platformLabel } from "@/domain/games/platform";
import type { Platform } from "@/domain/games/types";
import type {
  AccountSlot,
  SlotCustomer,
  CustomerInput,
} from "@/domain/slots/types";
import { can } from "@/domain/permissions/permissions";
import { CapacityCustomerModal } from "@/components/CapacityCustomerModal";

interface Props {
  account: Account;
  platform: Platform;
  gameTitle: string;
  highlighted?: boolean;
  /** Controlled expand/collapse from parent. Pass a new object each time to re-trigger. */
  expandSignal?: { open: boolean; rev: number } | null;
  onEdit?: (account: Account) => void;
  onViewDetails?: (account: Account) => void;
  onToggleStatus?: (accountId: string) => void;
  onDelete?: (accountId: string) => void;
  /** Capacity customer mutations — scoped to this account by the parent. */
  onAddCapacityCustomer?: (slotId: string, data: CustomerInput) => void;
  onEditCapacityCustomer?: (
    slotId: string,
    customerId: string,
    data: CustomerInput,
  ) => void;
  onRemoveCapacityCustomer?: (slotId: string, customerId: string) => void;
}

export function AccountCard({
  account,
  platform,
  gameTitle,
  highlighted,
  expandSignal,
  onEdit,
  onViewDetails,
  onToggleStatus,
  onDelete,
  onAddCapacityCustomer,
  onEditCapacityCustomer,
  onRemoveCapacityCustomer,
}: Props) {
  const [open, setOpen] = useState(highlighted ?? false);
  const [showPass, setShowPass] = useState(false);

  // Mobile actions menu
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Click-to-copy states for the two identifiers
  const [copiedNumber, setCopiedNumber] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Sync controlled expand/collapse signal from parent
  useEffect(() => {
    if (expandSignal != null) setOpen(expandSignal.open);
  }, [expandSignal]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const hasActions = onEdit || onViewDetails || onToggleStatus || onDelete;

  const copyNumber = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(account.number).then(() => {
      setCopiedNumber(true);
      setTimeout(() => setCopiedNumber(false), 1500);
    });
  };

  const copyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(account.accountCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    });
  };

  // Total assignments across all slots — recomputed from live state
  const totalAssignments = account.slots.reduce(
    (n, s) => n + s.customers.length,
    0,
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card shadow-soft",
        highlighted
          ? "border-primary ring-2 ring-primary/30 shadow-glow"
          : "border-border",
      )}
    >
      {/* ── Accordion header ───────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-right hover:bg-accent/40 cursor-pointer select-none"
      >
        {/* Left: avatar + identifiers */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {/* Avatar */}
          <div className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl gradient-primary text-primary-foreground font-bold text-sm shadow-glow">
            {account.number.slice(-3)}
          </div>

          {/* Info column */}
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* Row 1: per-game number + status badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Per-game number — click to copy */}
              <button
                type="button"
                onClick={copyNumber}
                title="کلیک برای کپی شماره اکانت"
                dir="ltr"
                className={cn(
                  "font-mono text-sm font-semibold leading-none whitespace-nowrap transition-colors cursor-copy",
                  copiedNumber ? "text-success" : "hover:text-primary",
                )}
              >
                {account.number}
              </button>
              {copiedNumber && (
                <Check className="h-3 w-3 shrink-0 text-success" />
              )}
              <StatusBadge status={account.status} />
            </div>

            {/* Row 2: accountCode (always visible) + game title */}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {/* Global account code — click to copy, always visible on all screen sizes */}
              <button
                type="button"
                onClick={copyCode}
                title="کلیک برای کپی Account ID"
                dir="ltr"
                className={cn(
                  "font-mono text-[10px] leading-none whitespace-nowrap transition-colors cursor-copy",
                  copiedCode
                    ? "text-success"
                    : "text-muted-foreground/70 hover:text-primary",
                )}
              >
                {account.accountCode}
              </button>
              {copiedCode && (
                <Check className="h-3 w-3 shrink-0 text-success" />
              )}
              <span className="text-border text-xs">·</span>
              <span className="text-xs text-muted-foreground truncate">
                {gameTitle}
              </span>
              <span className="hidden sm:inline text-border text-xs">·</span>
              <span className="hidden sm:inline shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {platformLabel(platform)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: capacity count + actions + chevron */}
        <div className="flex shrink-0 items-center gap-1.5">
          {/* Capacity count — desktop only */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1 text-[11px] text-muted-foreground">
            <Layers className="h-3 w-3" />
            <span className="tabular-nums">{account.slots.length}</span>
            <span>ظرفیت</span>
            {totalAssignments > 0 && (
              <>
                <span className="text-border">·</span>
                <Users className="h-3 w-3" />
                <span className="tabular-nums">{totalAssignments}</span>
              </>
            )}
          </div>

          {hasActions && (
            <>
              {/* Desktop: inline action buttons */}
              <span
                className="hidden sm:flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {onViewDetails && can("account.view.details") && (
                  <ActionButton
                    label="مشاهده اطلاعات اکانت"
                    onClick={() => onViewDetails(account)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </ActionButton>
                )}
                {onEdit && can("account.edit.email") && (
                  <ActionButton
                    label="ویرایش اکانت"
                    onClick={() => onEdit(account)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </ActionButton>
                )}
                {onToggleStatus && can("account.disable") && (
                  <ActionButton
                    label={
                      account.status === "active" ? "غیرفعال کردن" : "فعال کردن"
                    }
                    onClick={() => onToggleStatus(account.id)}
                  >
                    {account.status === "active" ? (
                      <PowerOff className="h-3.5 w-3.5" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                  </ActionButton>
                )}
                {onDelete && can("account.delete") && (
                  <ActionButton
                    label="حذف اکانت"
                    variant="danger"
                    onClick={() => onDelete(account.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </ActionButton>
                )}
              </span>

              {/* Mobile: three-dots dropdown menu */}
              <div
                ref={menuRef}
                className="relative sm:hidden"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!open && !menuOpen) setOpen(true);
                    setMenuOpen((v) => !v);
                  }}
                  aria-label="اقدامات بیشتر"
                  aria-expanded={menuOpen}
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-md transition-colors",
                    menuOpen
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {menuOpen && (
                  <div className="absolute left-0 top-full mt-1 z-30 min-w-[10.5rem] overflow-hidden rounded-xl border border-border bg-popover shadow-elevated py-1">
                    {onViewDetails && can("account.view.details") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onViewDetails(account);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-right hover:bg-accent"
                      >
                        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                        مشاهده اطلاعات اکانت
                      </button>
                    )}
                    {onEdit && can("account.edit.email") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(account);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-right hover:bg-accent"
                      >
                        <Pencil className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ویرایش
                      </button>
                    )}
                    {onToggleStatus && can("account.disable") && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onToggleStatus(account.id);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-right hover:bg-accent"
                      >
                        {account.status === "active" ? (
                          <PowerOff className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Power className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        {account.status === "active"
                          ? "غیرفعال‌سازی"
                          : "فعال‌سازی"}
                      </button>
                    )}
                    {onDelete && can("account.delete") && (
                      <>
                        <div className="mx-2 my-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onDelete(account.id);
                          }}
                          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-right text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4 shrink-0" />
                          حذف
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-300 ease-in-out",
              open && "rotate-180",
            )}
          />
        </div>
      </div>

      {/* ── Expanded panel — smooth CSS grid animation ─────────── */}
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-in-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          {/* Credentials */}
          <div className="grid grid-cols-1 gap-3 border-t border-border bg-muted/30 p-4 md:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={account.email} copy />
            <InfoRow
              icon={Key}
              label="PlayStation Password"
              value={
                showPass
                  ? account.password
                  : "•".repeat(Math.min(account.password.length, 16))
              }
              copyValue={account.password}
              copy
              trailing={
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPass((v) => !v);
                  }}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent"
                  aria-label={showPass ? "مخفی کردن رمز" : "نمایش رمز"}
                >
                  {showPass ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              }
            />

            {/* 2-step verification codes — full width, all codes shown */}
            <div className="md:col-span-2 rounded-xl border border-border bg-card px-3 py-2.5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] text-muted-foreground mb-2">
                    2-step verification codes
                  </span>
                  {account.backupCodes.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {account.backupCodes.map((code, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-1 rounded-lg bg-muted/60 px-2 py-1"
                        >
                          <span
                            className="font-mono text-xs truncate"
                            dir="ltr"
                          >
                            {code}
                          </span>
                          <CopyButton value={code} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Capacity slots */}
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                ظرفیت‌ها
              </h4>
              <span className="text-[11px] text-muted-foreground">
                {totalAssignments.toLocaleString("fa-IR")} تخصیص
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {account.slots.map((slot) => (
                <SlotBlock
                  key={slot.id}
                  slot={slot}
                  onAddCustomer={
                    onAddCapacityCustomer
                      ? (data) => onAddCapacityCustomer(slot.id, data)
                      : undefined
                  }
                  onEditCustomer={
                    onEditCapacityCustomer
                      ? (customerId, data) =>
                          onEditCapacityCustomer(slot.id, customerId, data)
                      : undefined
                  }
                  onRemoveCustomer={
                    onRemoveCapacityCustomer
                      ? (customerId) =>
                          onRemoveCapacityCustomer(slot.id, customerId)
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActionButton({
  label,
  variant,
  onClick,
  children,
}: {
  label: string;
  variant?: "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition-colors",
        variant === "danger"
          ? "text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: "active" | "disabled" }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        active
          ? "bg-success/15 text-success"
          : "bg-destructive/15 text-destructive",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-success animate-pulse" : "bg-destructive",
        )}
      />
      {active ? "فعال" : "غیرفعال"}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-accent"
      aria-label="کپی"
    >
      {copied ? (
        <Check className="h-3 w-3 text-success" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  copyValue,
  copy,
  trailing,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  copyValue?: string;
  copy?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] text-muted-foreground">{label}</span>
        <span className="block truncate font-mono text-xs" dir="ltr">
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

// ---------------------------------------------------------------------------
// SlotBlock — one capacity with full customer CRUD
// ---------------------------------------------------------------------------

function SlotBlock({
  slot,
  onAddCustomer,
  onEditCustomer,
  onRemoveCustomer,
}: {
  slot: AccountSlot;
  onAddCustomer?: (data: CustomerInput) => void;
  onEditCustomer?: (customerId: string, data: CustomerInput) => void;
  onRemoveCustomer?: (customerId: string) => void;
}) {
  const isPs5 = slot.type.includes("PS5");

  // Customer modal state
  const [addOpen, setAddOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<SlotCustomer | null>(
    null,
  );
  // Per-customer delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAddSave = (data: CustomerInput) => {
    onAddCustomer?.(data);
    setAddOpen(false);
  };

  const handleEditSave = (data: CustomerInput) => {
    if (!editingCustomer) return;
    onEditCustomer?.(editingCustomer.id, data);
    setEditingCustomer(null);
  };

  const handleRemove = (customerId: string) => {
    onRemoveCustomer?.(customerId);
    setConfirmDeleteId(null);
  };

  const canAdd = can("capacity.assignCustomer");
  const canEdit = can("capacity.editCustomer");
  const canRemove = can("capacity.removeCustomer");

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      {/* Slot header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
              isPs5
                ? "bg-primary/15 text-primary"
                : "bg-accent text-accent-foreground",
            )}
          >
            {isPs5 ? "PS5" : "PS4"}
          </span>
          <span className="truncate text-sm font-semibold">{slot.label}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            <span className="tabular-nums">
              {slot.customers.length.toLocaleString("fa-IR")}
            </span>
            <span>مشتری</span>
          </div>
          {onAddCustomer && canAdd && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              title="افزودن مشتری"
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
              aria-label="افزودن مشتری به این ظرفیت"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Customer list */}
      {slot.customers.length > 0 ? (
        <ul className="space-y-1.5">
          {slot.customers.map((c) => (
            <li key={c.id}>
              {confirmDeleteId === c.id ? (
                /* Inline delete confirmation */
                <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs">
                  <span className="text-destructive text-[11px]">
                    حذف این مشتری؟
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRemove(c.id)}
                      className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors"
                    >
                      بله
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-accent transition-colors"
                    >
                      خیر
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-start justify-between gap-2 rounded-lg bg-muted/60 px-2.5 py-2 text-xs">
                  {/* Customer info */}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {/* Phone — full, copyable */}
                    <div className="flex items-center gap-1">
                      <span className="font-mono truncate" dir="ltr">
                        {c.phone}
                      </span>
                      <CopyButton value={c.phone} />
                    </div>
                    {/* Order ID — copyable */}
                    <div className="flex items-center gap-1">
                      <span
                        className="text-[10px] text-muted-foreground"
                        dir="ltr"
                      >
                        {c.orderId}
                      </span>
                      <CopyButton value={c.orderId} />
                    </div>
                    {/* Note (optional) */}
                    {c.note && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-0.5">
                        <StickyNote className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{c.note}</span>
                      </div>
                    )}
                  </div>

                  {/* Per-customer actions */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {onEditCustomer && canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingCustomer(c)}
                        title="ویرایش مشتری"
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                        aria-label="ویرایش مشتری"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                    {onRemoveCustomer && canRemove && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(c.id)}
                        title="حذف مشتری"
                        className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
                        aria-label="حذف مشتری"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div
          className={cn(
            "rounded-lg border border-dashed border-border px-2.5 py-2 text-center text-[11px] text-muted-foreground",
            onAddCustomer &&
              canAdd &&
              "cursor-pointer hover:border-primary/40 hover:text-primary/80 transition-colors",
          )}
          onClick={onAddCustomer && canAdd ? () => setAddOpen(true) : undefined}
        >
          {onAddCustomer && canAdd
            ? "+ افزودن اولین مشتری"
            : "هنوز مشتری‌ای تخصیص نیافته"}
        </div>
      )}

      {/* Add customer modal */}
      <CapacityCustomerModal
        open={addOpen}
        mode="add"
        slotLabel={slot.label}
        onSave={handleAddSave}
        onClose={() => setAddOpen(false)}
      />

      {/* Edit customer modal */}
      <CapacityCustomerModal
        open={editingCustomer !== null}
        mode="edit"
        slotLabel={slot.label}
        initial={editingCustomer ?? undefined}
        onSave={handleEditSave}
        onClose={() => setEditingCustomer(null)}
      />
    </div>
  );
}
