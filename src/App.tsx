import { Toaster } from "@/components/ui/sonner";
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
import Marketplace from "./pages/Marketplace";
import QuickSend from "./pages/QuickSend";
import Invoices from "./pages/Invoices";
import History from "./pages/History";
import Analytics from "./pages/Analytics";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminPlans from "./pages/admin/AdminPlans";
import AdminFinancial from "./pages/admin/AdminFinancial";
import AdminTutorials from "./pages/admin/AdminTutorials";
import AdminLandingContent from "./pages/admin/AdminLandingContent";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminAuthLogs from "./pages/admin/AdminAuthLogs";
import AdminSystemHealth from "./pages/admin/AdminSystemHealth";
import AdminUserSegments from "./pages/admin/AdminUserSegments";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminUserActivity from "./pages/admin/AdminUserActivity";
import AdminSubscriptionAnalytics from "./pages/admin/AdminSubscriptionAnalytics";
import AdminPaymentAnalytics from "./pages/admin/AdminPaymentAnalytics";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminDevices from "./pages/admin/AdminDevices";
import AdminReminders from "./pages/admin/AdminReminders";
import AdminTemplates from "./pages/admin/AdminTemplates";
import { AdminServerManagement } from "./pages/admin/AdminServerManagement";
import Tutorial from "./pages/Tutorial";
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
            <Route path="/marketplace" element={<ProtectedRoute requiredRole="user"><Marketplace /></ProtectedRoute>} />
            <Route path="/quick-send" element={<ProtectedRoute requiredRole="user"><QuickSend /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute requiredRole="user"><Invoices /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute requiredRole="user"><History /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute requiredRole="user"><Analytics /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute requiredRole="user"><Settings /></ProtectedRoute>} />
            <Route path="/pricing" element={<ProtectedRoute requiredRole="user"><Pricing /></ProtectedRoute>} />
            <Route path="/payment" element={<ProtectedRoute requiredRole="user"><Payment /></ProtectedRoute>} />
            <Route path="/tutorial" element={<ProtectedRoute requiredRole="user"><Tutorial /></ProtectedRoute>} />

            {/* Admin Routes - Protected */}
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requiredRole="admin"><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/plans" element={<ProtectedRoute requiredRole="admin"><AdminPlans /></ProtectedRoute>} />
            <Route path="/admin/financial" element={<ProtectedRoute requiredRole="admin"><AdminFinancial /></ProtectedRoute>} />
            <Route path="/admin/tutorials" element={<ProtectedRoute requiredRole="admin"><AdminTutorials /></ProtectedRoute>} />
            <Route path="/admin/landing-content" element={<ProtectedRoute requiredRole="admin"><AdminLandingContent /></ProtectedRoute>} />
            <Route path="/admin/audit-logs" element={<ProtectedRoute requiredRole="admin"><AdminAuditLogs /></ProtectedRoute>} />
            <Route path="/admin/auth-logs" element={<ProtectedRoute requiredRole="admin"><AdminAuthLogs /></ProtectedRoute>} />
            <Route path="/admin/system-health" element={<ProtectedRoute requiredRole="admin"><AdminSystemHealth /></ProtectedRoute>} />
            <Route path="/admin/user-segments" element={<ProtectedRoute requiredRole="admin"><AdminUserSegments /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/admin/revenue" element={<ProtectedRoute requiredRole="admin"><AdminRevenue /></ProtectedRoute>} />
            <Route path="/admin/user-activity" element={<ProtectedRoute requiredRole="admin"><AdminUserActivity /></ProtectedRoute>} />
            <Route path="/admin/subscription-analytics" element={<ProtectedRoute requiredRole="admin"><AdminSubscriptionAnalytics /></ProtectedRoute>} />
            <Route path="/admin/payment-analytics" element={<ProtectedRoute requiredRole="admin"><AdminPaymentAnalytics /></ProtectedRoute>} />
            <Route path="/admin/broadcast" element={<ProtectedRoute requiredRole="admin"><AdminBroadcast /></ProtectedRoute>} />
            <Route path="/admin/devices" element={<ProtectedRoute requiredRole="admin"><AdminDevices /></ProtectedRoute>} />
            <Route path="/admin/templates" element={<ProtectedRoute requiredRole="admin"><AdminTemplates /></ProtectedRoute>} />
            <Route path="/admin/reminders" element={<ProtectedRoute requiredRole="admin"><AdminReminders /></ProtectedRoute>} />
            <Route path="/admin/server-management" element={<ProtectedRoute requiredRole="admin"><AdminServerManagement /></ProtectedRoute>} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
