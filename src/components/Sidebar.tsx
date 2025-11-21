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
  Settings,
  LogOut,
  Menu,
  X,
  Repeat
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: PlayCircle, label: "Tutorial", path: "/tutorial" },
  { icon: Radio, label: "Devices", path: "/devices" },
  { icon: Users, label: "Kontak", path: "/contacts" },
  { icon: FileText, label: "Template", path: "/templates" },
];

const messagingItems = [
  { icon: Send, label: "Broadcast", path: "/broadcast" },
  { icon: Zap, label: "Kirim Cepat", path: "/quick-send" },
  { icon: Calendar, label: "Jadwal", path: "/scheduled" },
  { icon: Repeat, label: "Recurring", path: "/recurring", badge: "New" },
  { icon: Send, label: "Auto Post", path: "/auto-post", badge: "New" },
];

const featuresItems = [
  { icon: ShoppingCart, label: "Marketplace", path: "/marketplace" },
  { icon: Bot, label: "Chatbot", path: "/chatbot" },
  { icon: Webhook, label: "Webhook", path: "/webhooks" },
];

const settingsItems = [
  { icon: History, label: "History", path: "/history" },
  { icon: DollarSign, label: "Harga", path: "/pricing" },
  { icon: Receipt, label: "Invoice", path: "/invoices" },
  { icon: Key, label: "API Key", path: "/api-keys" },
  { icon: Settings, label: "Pengaturan", path: "/settings" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar = ({ isOpen = false, onClose }: SidebarProps = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const open = isOpen || internalOpen;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Desktop: expanded state is controlled by hover
  const isExpanded = isHovered;

  const handleClose = () => {
    setInternalOpen(false);
    onClose?.();
  };

  // Save scroll position to sessionStorage whenever it changes
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      sessionStorage.setItem('sidebar-scroll-position', scrollContainer.scrollTop.toString());
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Restore scroll position when component mounts or location changes
  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const savedPosition = sessionStorage.getItem('sidebar-scroll-position');
    if (savedPosition) {
      const scrollTop = parseInt(savedPosition, 10);
      scrollContainer.style.scrollBehavior = 'auto';
      scrollContainer.scrollTop = scrollTop;
      requestAnimationFrame(() => {
        scrollContainer.style.scrollBehavior = '';
      });
    }
  }, [location.pathname]);

  const NavItem = ({ icon: Icon, label, path, badge }: any) => {
    const pathWithoutQuery = path.split('?')[0];
    const pathQuery = path.includes('?') ? '?' + path.split('?')[1] : '';

    const isActive = location.pathname === pathWithoutQuery &&
      location.search === pathQuery;

    // Only close sidebar on mobile (screen width < 1024px)
    // Desktop hover behavior should not be affected by clicks
    const handleClick = () => {
      const isMobile = window.innerWidth < 1024;
      if (isMobile) {
        handleClose();
      }
    };

    return (
      <Link
        to={path}
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-md transition-all duration-200 group relative",
          "hover:bg-sidebar-accent",
          isActive && "bg-gradient-to-r from-primary/10 to-secondary/10 border-l-2 border-primary"
        )}
        onClick={handleClick}
        title={!isExpanded ? label : undefined}
      >
        <Icon
          className={cn(
            "w-5 h-5 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
          )}
        />
        <span
          className={cn(
            "text-sm font-medium transition-all duration-150 ease-out",
            isActive ? "text-primary" : "text-foreground",
            !isExpanded && "lg:opacity-0 lg:w-0 lg:overflow-hidden"
          )}
        >
          {label}
        </span>
        {badge && isExpanded && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-destructive text-destructive-foreground rounded-full">
            {badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div
      ref={sidebarRef}
      className="flex flex-col h-full bg-sidebar-background border-r border-sidebar-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Logo */}
      <div className="p-3 border-b border-sidebar-border flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center shrink-0",
            "transition-all duration-150 ease-out"
          )}>
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div className={cn(
            "transition-all duration-150 ease-out",
            !isExpanded && "lg:opacity-0 lg:w-0 lg:overflow-hidden"
          )}>
            <h1 className="text-base font-bold text-foreground whitespace-nowrap">HalloWa</h1>
            <p className="text-xs text-muted-foreground whitespace-nowrap">WhatsApp Manager</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={handleClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Navigation */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-2 space-y-4 custom-scrollbar">
        {/* Main Menu */}
        <div className="space-y-0.5">
          {menuItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Messaging Section */}
        <div className="space-y-0.5">
          <h3 className={cn(
            "px-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1",
            "transition-all duration-150 ease-out",
            !isExpanded && "lg:text-center lg:px-0"
          )}>
            {isExpanded ? 'Messaging' : 'MSG'}
          </h3>
          {messagingItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Features Section */}
        <div className="space-y-0.5">
          <h3 className={cn(
            "px-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1",
            "transition-all duration-150 ease-out",
            !isExpanded && "lg:text-center lg:px-0"
          )}>
            {isExpanded ? 'Features' : 'FTR'}
          </h3>
          {featuresItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>

        {/* Settings Section */}
        <div className="space-y-0.5">
          <h3 className={cn(
            "px-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1",
            "transition-all duration-150 ease-out",
            !isExpanded && "lg:text-center lg:px-0"
          )}>
            {isExpanded ? 'Settings' : 'SET'}
          </h3>
          {settingsItems.map((item) => (
            <NavItem key={item.path} {...item} />
          ))}
        </div>
      </div>

      {/* Profile & Logout Section */}
      <div className={cn(
        "p-2 border-t border-sidebar-border",
        "transition-all duration-150 ease-out"
      )}>
        <div className={cn(
          "flex items-center gap-2 p-2 rounded-lg hover:bg-sidebar-accent transition-colors cursor-pointer group",
          !isExpanded && "lg:justify-center"
        )}>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-white" />
          </div>

          {/* User Info & Logout - Only visible when expanded */}
          <div className={cn(
            "flex-1 min-w-0 transition-all duration-150 ease-out",
            !isExpanded && "lg:opacity-0 lg:w-0 lg:overflow-hidden"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate text-foreground">
                  {user?.email?.split('@')[0] || 'User'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={signOut}
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Logout Icon Only - Show when collapsed on desktop */}
          {!isExpanded && (
            <LogOut
              className="hidden lg:block w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors absolute opacity-0 group-hover:opacity-100"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </div>

        {/* Copyright - Only when expanded */}
        <p className={cn(
          "text-[10px] text-muted-foreground text-center mt-2 transition-all duration-150 ease-out",
          !isExpanded && "lg:opacity-0 lg:h-0"
        )}>
          © 2025 HalloWa.id
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-[60]"
          onClick={handleClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen z-[70]",
          "transform transition-all duration-200 ease-out",
          // Mobile
          open ? "translate-x-0 w-64" : "-translate-x-full w-64",
          // Desktop
          "lg:translate-x-0",
          isExpanded ? "lg:w-64" : "lg:w-16"
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
    className="lg:hidden fixed bottom-16 right-4 z-50 w-12 h-12 rounded-full bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
    onClick={onClick}
  >
    <Menu className="w-5 h-5" />
  </Button>
);
