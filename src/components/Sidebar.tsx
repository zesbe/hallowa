import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PlayCircle,
  MessageSquare,
  Radio,
  Users,
  UserCircle,
  FileText,
  Send,
  Calendar,
  ShoppingCart,
  Zap,
  Bot,
  Webhook,
  History,
  DollarSign,
  Receipt,
  Key,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: PlayCircle, label: "Video Tutorial", path: "/tutorial" },
  { icon: MessageSquare, label: "CRM Chat", path: "/crm-chat", badge: "New" },
  { icon: Radio, label: "Device Broadcast", path: "/devices" },
  { icon: Users, label: "Grup Kontak", path: "/groups" },
  { icon: UserCircle, label: "List Kontak", path: "/contacts" },
  { icon: FileText, label: "Daftar Template", path: "/templates" },
];

const messagingItems = [
  { icon: Send, label: "Broadcast Pesan", path: "/broadcast" },
  { icon: Calendar, label: "Jadwal Broadcast", path: "/scheduled" },
];

const featuresItems = [
  { icon: ShoppingCart, label: "MarketPlace", path: "/marketplace" },
  { icon: Zap, label: "Kirim Cepat", path: "/quick-send" },
  { icon: Bot, label: "Chatbot (Auto Reply)", path: "/chatbot" },
  { icon: Webhook, label: "Webhook App", path: "/webhooks" },
];

const settingsItems = [
  { icon: History, label: "History Pesan", path: "/history" },
  { icon: DollarSign, label: "Daftar Harga", path: "/pricing" },
  { icon: Receipt, label: "Invoice", path: "/invoices" },
  { icon: Key, label: "API Key", path: "/api-keys" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps = {}) => {
  const location = useLocation();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen || internalOpen;
  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  const NavItem = ({ icon: Icon, label, path, badge }: any) => {
    const isActive = location.pathname === path;
    
    return (
      <Link
        to={path}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
          "hover:bg-sidebar-accent group relative",
          isActive && "bg-gradient-to-r from-primary/10 to-secondary/10 border-l-4 border-primary"
        )}
        onClick={handleClose}
      >
        <Icon
          className={cn(
            "w-5 h-5 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
          )}
        />
        <span
          className={cn(
            "font-medium transition-colors",
            isActive ? "text-primary" : "text-foreground"
          )}
        >
          {label}
        </span>
        {badge && (
          <span className="ml-auto text-xs px-2 py-1 bg-destructive text-destructive-foreground rounded-full">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-sidebar-background border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">WAPANELS</h1>
            <p className="text-xs text-muted-foreground">WhatsApp Manager</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={handleClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Main Menu */}
        <div className="space-y-1">
          {menuItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Messaging Section */}
        <div className="space-y-1">
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Messaging
          </h3>
          {messagingItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Features Section */}
        <div className="space-y-1">
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Features
          </h3>
          {featuresItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Settings Section */}
        <div className="space-y-1">
          <h3 className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Settings
          </h3>
          {settingsItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Link
          to="/logout"
          className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </Link>
        <p className="text-xs text-muted-foreground text-center mt-3">© 2025 WATSAP.ID</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          onClick={handleClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-72 z-[70] transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
};

// Export mobile menu toggle button separately
export const MobileMenuButton = ({ onClick }: { onClick: () => void }) => (
  <Button
    variant="ghost"
    size="icon"
    className="lg:hidden w-11 h-11 bg-background/95 backdrop-blur border shadow-sm hover:bg-accent"
    onClick={onClick}
  >
    <Menu className="w-6 h-6" />
  </Button>
);
