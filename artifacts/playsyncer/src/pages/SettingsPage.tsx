import { Moon, Sun, Palette } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-10">
      <header>
        <div className="text-xs font-medium text-muted-foreground">تنظیمات</div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">شخصی‌سازی پنل</h1>
        <p className="mt-1 text-sm text-muted-foreground">ظاهر و ترجیحات نمایش را تنظیم کنید.</p>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">تم رنگی</div>
            <div className="text-xs text-muted-foreground">حالت تاریک گیمینگ یا روشن مینیمال</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <ThemeCard
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
            icon={<Moon className="h-4 w-4" />}
            title="تاریک — گیمینگ"
            desc="پس‌زمینه شب، رنگ‌های عمیق آبی"
          />
          <ThemeCard
            active={theme === "light"}
            onClick={() => setTheme("light")}
            icon={<Sun className="h-4 w-4" />}
            title="روشن"
            desc="ظاهر تمیز و روزانه"
          />
        </div>
      </section>
    </div>
  );
}

function ThemeCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-right rounded-xl border p-4 transition-all",
        active
          ? "border-primary bg-primary/10 shadow-glow"
          : "border-border bg-card hover:border-primary/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-8 w-8 place-items-center rounded-lg",
            active ? "gradient-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
