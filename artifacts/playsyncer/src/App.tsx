import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "@/hooks/useTheme";
import { SidebarProvider } from "@/hooks/useSidebar";
import { GamesProvider } from "@/hooks/useGames";
import { AppSidebar } from "@/components/AppSidebar";
import { AppTopBar } from "@/components/AppTopBar";
import GamesPage from "@/pages/GamesPage";
import GameDetailPage from "@/pages/GameDetailPage";
import OrdersPage from "@/pages/OrdersPage";
import IssuesPage from "@/pages/IssuesPage";
import StaffPage from "@/pages/StaffPage";
import SettingsPage from "@/pages/SettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <GamesProvider>
          <div className="flex h-dvh w-full flex-col overflow-hidden bg-transparent text-foreground lg:flex-row">
            <AppSidebar />
            {/* Content column: desktop header bar + scrollable page content */}
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <AppTopBar />
              <main className="min-w-0 w-full flex-1 overflow-y-auto">
                <AnimatedRoutes />
              </main>
            </div>
          </div>
        </GamesProvider>
      </SidebarProvider>
    </ThemeProvider>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <>
      <ScrollToTop />
      <div key={location.pathname} className="animate-page-in">
        <Routes location={location}>
          <Route path="/" element={<GamesPage />} />
          <Route path="/games/:gameId" element={<GameDetailPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/issues" element={<IssuesPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </>
  );
}
