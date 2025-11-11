import { ReactNode, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { RealTimeAlerts } from "./admin/RealTimeAlerts";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  DollarSign,
  LogOut,
  Menu,
  X,
  Shield,
  Video,
  FileText,
  Activity,
  ListChecks,
  BarChart,
  Mail,
  Smartphone,
  Bell,
  MessageSquare
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { supabase } from "@/integrations/supabase/client";

interface AdminLayoutProps {
  children: ReactNode;
}

export const AdminLayout = ({ children }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string>("");

  // 🔒 Security: Auto-logout after 30 minutes of inactivity
  useSessionTimeout();

  useEffect(() => {
    if (user?.email) {
      setAdminEmail(user.email);
    }
  }, [user]);

  // Scroll to active item in sidebar
  useEffect(() => {
    const activeButton = document.querySelector('.sidebar-nav-active');
    if (activeButton && sidebarOpen) {
      activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [location.pathname, sidebarOpen]);

  const menuItems = [
    { icon: LayoutDashboard, label: "Dasbor", path: "/admin/dashboard" },
    { icon: Smartphone, label: "Perangkat Saya", path: "/admin/devices" },
    { icon: MessageSquare, label: "Siaran", path: "/admin/broadcast" },
    { icon: FileText, label: "Template", path: "/admin/templates" },
    { icon: Bell, label: "Pengingat", path: "/admin/reminders" },
    { icon: Users, label: "Kelola User", path: "/admin/users" },
    { icon: CreditCard, label: "Kelola Paket", path: "/admin/plans" },
    { icon: Video, label: "Kelola Tutorial", path: "/admin/tutorials" },
    { icon: FileText, label: "Konten Landing", path: "/admin/landing-content" },
    { icon: DollarSign, label: "Laporan Keuangan", path: "/admin/financial" },
    { icon: Activity, label: "Kesehatan Sistem", path: "/admin/system-health" },
    { icon: Shield, label: "Manajemen Server", path: "/admin/server-management" },
    { icon: ListChecks, label: "Log Audit", path: "/admin/audit-logs" },
    { icon: Users, label: "Segmen Pengguna", path: "/admin/user-segments" },
    { icon: BarChart, label: "Analitik", path: "/admin/analytics" },
    { icon: DollarSign, label: "Pendapatan", path: "/admin/revenue" },
    { icon: Activity, label: "Aktivitas Pengguna", path: "/admin/user-activity" },
    { icon: CreditCard, label: "Langganan", path: "/admin/subscription-analytics" },
    { icon: CreditCard, label: "Pembayaran", path: "/admin/payment-analytics" },
  ];

  // Mobile bottom navigation items (main features only)
  const mobileBottomNav = [
    { icon: LayoutDashboard, label: "Dasbor", path: "/admin/dashboard" },
    { icon: Users, label: "User", path: "/admin/users" },
    { icon: BarChart, label: "Analitik", path: "/admin/analytics" },
    { icon: Menu, label: "Menu", action: "menu" },
  ];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-primary">Admin Panel</h1>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant="ghost"
                  className={`w-full justify-start ${
                    isActive ? 'sidebar-nav-active bg-primary/10 text-primary' : ''
                  }`}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Admin Info */}
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">Admin</p>
                <p className="text-sm font-medium truncate" title={adminEmail}>
                  {adminEmail || "Loading..."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b shadow-sm">
          <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <RealTimeAlerts />
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950 shrink-0"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </div>
        </header>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto pb-20 lg:pb-0">
          <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
            {children}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t shadow-lg">
          <div className="flex items-center justify-around h-16 px-2">
            {mobileBottomNav.map((item) => {
              const isActive = item.path ? location.pathname === item.path : sidebarOpen && item.action === "menu";
              const handleClick = () => {
                if (item.action === "menu") {
                  setSidebarOpen(!sidebarOpen);
                } else if (item.path) {
                  navigate(item.path);
                }
              };

              return (
                <button
                  key={item.label}
                  onClick={handleClick}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </main>
    </div>
  );
};
