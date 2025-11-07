import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster as HotToaster } from "react-hot-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { InstallPWA } from "@/components/InstallPWA";
import Landing from "./pages/Landing";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import { DashboardEnterprise as Dashboard } from "./pages/DashboardEnterprise";
import Devices from "./pages/Devices";
import Broadcast from "./pages/Broadcast";
import Scheduled from "./pages/Scheduled";
import Templates from "./pages/Templates";
import Settings from "./pages/Settings";
import Contacts from "./pages/Contacts";
import Chatbot from "./pages/Chatbot";
import ApiKeys from "./pages/ApiKeys";
import ApiDocs from "./pages/ApiDocs";
import Webhooks from "./pages/Webhooks";
import CrmChat from "./pages/CrmChat";
import AutoPost from "./pages/AutoPost";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminFinancial from "./pages/admin/AdminFinancial";
import Pricing from "./pages/Pricing";
import Payment from "./pages/Payment";
import ResetPassword from "./pages/ResetPassword";
import UpdatePassword from "./pages/UpdatePassword";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="system" storageKey="wapanels-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <HotToaster position="top-right" />
        <InstallPWA />
        <BrowserRouter>
          <Routes>
            {/* Public Landing Page with SEO */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/update-password" element={<UpdatePassword />} />
            <Route path="/admin" element={<Navigate to="/admin/login" replace />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* User Routes - Protected */}
            <Route path="/dashboard" element={<ProtectedRoute requiredRole="user"><Dashboard /></ProtectedRoute>} />
            <Route path="/devices" element={<ProtectedRoute requiredRole="user"><Devices /></ProtectedRoute>} />
            <Route path="/broadcast" element={<ProtectedRoute requiredRole="user"><Broadcast /></ProtectedRoute>} />
            <Route path="/scheduled" element={<ProtectedRoute requiredRole="user"><Scheduled /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute requiredRole="user"><Templates /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute requiredRole="user"><Contacts /></ProtectedRoute>} />
            <Route path="/chatbot" element={<ProtectedRoute requiredRole="user"><Chatbot /></ProtectedRoute>} />
            <Route path="/api-keys" element={<ProtectedRoute requiredRole="user"><ApiKeys /></ProtectedRoute>} />
            <Route path="/api-docs" element={<ProtectedRoute requiredRole="user"><ApiDocs /></ProtectedRoute>} />
            <Route path="/webhooks" element={<ProtectedRoute requiredRole="user"><Webhooks /></ProtectedRoute>} />
            <Route path="/crm-chat" element={<ProtectedRoute requiredRole="user"><CrmChat /></ProtectedRoute>} />
            <Route path="/auto-post" element={<ProtectedRoute requiredRole="user"><AutoPost /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="user"><Settings /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute requiredRole="user"><Pricing /></ProtectedRoute>} />
            <Route path="/payment" element={<ProtectedRoute requiredRole="user"><Payment /></ProtectedRoute>} />
            
            {/* Admin Routes - Protected */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/plans" element={<ProtectedRoute requiredRole="admin"><AdminPlans /></ProtectedRoute>} />
            <Route path="/admin/financial" element={<ProtectedRoute requiredRole="admin"><AdminFinancial /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
