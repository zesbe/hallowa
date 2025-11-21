import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { Progress } from "@/components/ui/progress";
import { RecentActivity } from "@/components/RecentActivity";
import {
  Smartphone,
  Users,
  MessageSquare,
  Send,
  TrendingUp,
  Plus,
  Radio,
  Activity,
  BarChart3,
  Zap,
  Globe,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
  Wifi,
  WifiOff
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change: number;
  changeType: 'positive' | 'negative' | 'neutral';
  className?: string;
  delay?: number;
}

const EnterpriseStatCard = ({ title, value, icon: Icon, change, changeType, className, delay = 0 }: StatCardProps) => {
  return (
    <Card 
      className={cn(
        "relative overflow-hidden border-0 shadow-lg hover-lift card-enterprise animate-fade-in",
        className
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-gradient-green">{value.toLocaleString()}</p>
            <div className="flex items-center gap-1">
              {changeType === 'positive' ? (
                <ArrowUpRight className="w-4 h-4 text-green-500" />
              ) : changeType === 'negative' ? (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              ) : (
                <Activity className="w-4 h-4 text-gray-500" />
              )}
              <span className={cn(
                "text-sm font-medium",
                changeType === 'positive' ? "text-green-500" : 
                changeType === 'negative' ? "text-red-500" : "text-gray-500"
              )}>
                {change > 0 ? '+' : ''}{change}%
              </span>
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl">
            <Icon className="w-6 h-6 text-primary animate-float" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const DashboardEnterprise = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState({
    totalDevices: 0,
    connectedDevices: 0,
    totalContacts: 0,
    messagesSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: devicesData, error: devicesError } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (devicesError) throw devicesError;

      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      const { count: messagesCount } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true });

      setDevices(devicesData || []);
      const connectedCount = devicesData?.filter((d) => d.status === "connected").length || 0;
      
      setStats({
        totalDevices: devicesData?.length || 0,
        connectedDevices: connectedCount,
        totalContacts: contactsCount || 0,
        messagesSent: messagesCount || 0,
      });
    } catch (error) {
      toast.error("Gagal memuat data dashboard");
      if (import.meta.env.DEV) {
        console.error("Dashboard fetch error:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="w-4 h-4 text-green-500 animate-pulse" />;
      case "connecting":
        return <Clock className="w-4 h-4 text-yellow-500 animate-rotate" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      connected: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200",
      connecting: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200",
      disconnected: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200"
    };
    return configs[status as keyof typeof configs] || configs.disconnected;
  };

  const connectionRate = stats.totalDevices > 0 
    ? Math.round((stats.connectedDevices / stats.totalDevices) * 100)
    : 0;

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Welcome back! Here's what's happening with your WhatsApp network
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/broadcast")}
              className="btn-enterprise border-gradient-animate"
            >
              <Send className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Quick Broadcast</span>
              <span className="sm:hidden">Broadcast</span>
            </Button>
            <Button
              onClick={() => navigate("/devices")}
              className="gradient-enterprise-green text-white shadow-lg hover:shadow-xl transition-all btn-enterprise"
            >
              <Plus className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Add Device</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <EnterpriseStatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon={Smartphone}
            change={12}
            changeType="positive"
            delay={0}
          />
          <EnterpriseStatCard
            title="Connected"
            value={stats.connectedDevices}
            icon={Radio}
            change={connectionRate}
            changeType={connectionRate > 50 ? "positive" : "negative"}
            delay={100}
          />
          <EnterpriseStatCard
            title="Total Contacts"
            value={stats.totalContacts}
            icon={Users}
            change={5}
            changeType="positive"
            delay={200}
          />
          <EnterpriseStatCard
            title="Messages Sent"
            value={stats.messagesSent}
            icon={MessageSquare}
            change={23}
            changeType="positive"
            delay={300}
          />
        </div>

        {/* Connection Health */}
        <Card className="border-0 shadow-lg animate-fade-in glass-morphism" style={{ animationDelay: '400ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <span>Connection Health</span>
              </div>
              <Badge className="gradient-enterprise-green text-white">
                {connectionRate}% Online
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress value={connectionRate} className="h-3" />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-green-500" />
                  <p className="text-sm font-medium">{stats.connectedDevices}</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
                <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
                  <p className="text-sm font-medium">0</p>
                  <p className="text-xs text-muted-foreground">Connecting</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950/30">
                  <XCircle className="w-6 h-6 mx-auto mb-1 text-gray-500" />
                  <p className="text-sm font-medium">{stats.totalDevices - stats.connectedDevices}</p>
                  <p className="text-xs text-muted-foreground">Offline</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Status */}
        <div className="animate-fade-in" style={{ animationDelay: '500ms' }}>
          <SubscriptionStatus />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Devices */}
          <Card className="border-0 shadow-lg animate-slide-in-left hover-lift">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Recent Devices
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-16 rounded-lg" />
                  ))}
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                    <Smartphone className="w-10 h-10 text-primary animate-float" />
                  </div>
                  <p className="text-muted-foreground mb-4">No devices registered yet</p>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/devices")}
                    className="btn-enterprise"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Device
                  </Button>
                </div>
              ) : (
                <div className="divide-y">
                  {devices.map((device, index) => (
                    <div
                      key={device.id}
                      className="p-4 hover:bg-accent/50 transition-all cursor-pointer group animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                      onClick={() => navigate("/devices")}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Smartphone className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{device.device_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {device.phone_number || "Not connected"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(device.status)}
                          <Badge className={cn("border", getStatusBadge(device.status))}>
                            {device.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="border-0 shadow-lg animate-slide-in-right hover-lift">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
              {[
                { icon: Send, label: "Send Broadcast", path: "/broadcast", color: "from-blue-500 to-indigo-600" },
                { icon: Users, label: "Manage Contacts", path: "/contacts", color: "from-green-500 to-emerald-600" },
                { icon: MessageSquare, label: "Message Templates", path: "/templates", color: "from-purple-500 to-pink-600" },
                { icon: BarChart3, label: "View Analytics", path: "/analytics", color: "from-orange-500 to-red-600" },
              ].map((action, index) => (
                <Button
                  key={action.path}
                  variant="outline"
                  className="w-full justify-start group hover-lift btn-enterprise animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                  onClick={() => navigate(action.path)}
                >
                  <div className={cn(
                    "p-2 rounded-lg bg-gradient-to-r mr-3 group-hover:scale-110 transition-transform",
                    action.color
                  )}>
                    <action.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-medium">{action.label}</span>
                  <ArrowUpRight className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
          <RecentActivity />
        </div>
      </div>
    </Layout>
  );
};