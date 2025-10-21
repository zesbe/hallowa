import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, MessageSquare, Smartphone } from "lucide-react";

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDevices: 0,
    totalBroadcasts: 0,
    activeSubscriptions: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [usersRes, devicesRes, broadcastsRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("devices").select("id", { count: "exact" }),
        supabase.from("broadcasts").select("id", { count: "exact" }),
        supabase.from("user_subscriptions").select("id", { count: "exact" }).eq("status", "active"),
      ]);

      setStats({
        totalUsers: usersRes.count || 0,
        totalDevices: devicesRes.count || 0,
        totalBroadcasts: broadcastsRes.count || 0,
        activeSubscriptions: subsRes.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const statCards = [
    { title: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
    { title: "Total Devices", value: stats.totalDevices, icon: Smartphone, color: "text-green-500" },
    { title: "Total Broadcasts", value: stats.totalBroadcasts, icon: MessageSquare, color: "text-purple-500" },
    { title: "Active Subscriptions", value: stats.activeSubscriptions, icon: CreditCard, color: "text-orange-500" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-2">
            Kelola sistem dan monitor statistik
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
