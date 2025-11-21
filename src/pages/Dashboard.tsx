import { Layout } from "@/components/Layout";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubscriptionStatus } from "@/components/SubscriptionStatus";
import { RecentActivity } from "@/components/RecentActivity";
import {
  Smartphone,
  Users,
  MessageSquare,
  Send,
  TrendingUp,
  Plus,
  Radio,
  BarChart3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
}

export const Dashboard = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState({
    totalDevices: 0,
    connectedDevices: 0,
    totalContacts: 0,
    messagesSent: 0,
  });

  useEffect(() => {
    fetchDashboardData();
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
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-success text-success-foreground";
      case "connecting":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Dashboard</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Kelola semua perangkat WhatsApp Anda dalam satu tempat
            </p>
          </div>
          <Button
            onClick={() => navigate("/devices")}
            className="bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl transition-all w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Device
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          <StatCard
            title="Total Devices"
            value={stats.totalDevices}
            icon={Smartphone}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Connected"
            value={stats.connectedDevices}
            icon={Radio}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Total Kontak"
            value={stats.totalContacts}
            icon={Users}
            trend={{ value: 5, isPositive: true }}
          />
          <StatCard
            title="Pesan Terkirim"
            value={stats.messagesSent}
            icon={MessageSquare}
            trend={{ value: 23, isPositive: true }}
          />
        </div>

        <SubscriptionStatus />

        {/* Recent Activity */}
        <RecentActivity />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Devices */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Recent Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Belum ada device yang terdaftar</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/devices")}
                  >
                    Tambah Device Pertama
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{device.device_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {device.phone_number || "Not connected"}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(device.status)}>
                        {device.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/broadcast")}
              >
                <Send className="w-4 h-4 mr-3" />
                Kirim Broadcast Baru
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/templates")}
              >
                <MessageSquare className="w-4 h-4 mr-3" />
                Buat Template Pesan
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/chatbot")}
              >
                <MessageSquare className="w-4 h-4 mr-3" />
                Setup Auto Reply
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/contacts")}
              >
                <Users className="w-4 h-4 mr-3" />
                Import Kontak
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate("/analytics")}
              >
                <BarChart3 className="w-4 h-4 mr-3" />
                Lihat Analytics
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;
