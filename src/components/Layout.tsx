import { ReactNode, useState } from "react";
import { Sidebar, MobileMenuButton } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { MobileBottomNav } from "./MobileBottomNav";
import { FloatingActionButton } from "./FloatingActionButton";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - works on both mobile and desktop */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container mx-auto px-4 md:px-6 py-3 flex items-center justify-end gap-3">
            <ThemeToggle />
            {/* Mobile Menu Button - Di pojok kanan atas */}
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          </div>
        </div>
        <div className="container mx-auto px-4 md:px-6 py-4 md:py-8">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
      
      {/* Floating Action Button */}
      <FloatingActionButton />
    </div>
  );
};
