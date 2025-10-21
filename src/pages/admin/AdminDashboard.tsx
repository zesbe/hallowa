import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, MessageSquare, Smartphone, Calendar } from "lucide-react";

interface RecentUser {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  role: string;
  subscription: {
    plan_name: string;
    status: string;
  } | null;
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalDevices: 0,
    totalBroadcasts: 0,
    activeSubscriptions: 0,
  });
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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

      // Fetch recent users
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (profiles) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", profiles.map(p => p.id));

        const { data: subsData } = await supabase
          .from("user_subscriptions")
          .select(`
            user_id,
            status,
            plans (name)
          `)
          .in("user_id", profiles.map(p => p.id))
          .eq("status", "active");

        const users: RecentUser[] = profiles.map(profile => {
          const role = rolesData?.find(r => r.user_id === profile.id);
          const subscription = subsData?.find(s => s.user_id === profile.id);

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            created_at: profile.created_at,
            role: role?.role || "user",
            subscription: subscription ? {
              plan_name: (subscription.plans as any)?.name || "Free",
              status: subscription.status,
            } : null,
          };
        });

        setRecentUsers(users);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
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
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard Admin</h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Kelola sistem dan monitor statistik
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.color} shrink-0`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl sm:text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="p-4 sm:p-6">
          <CardHeader className="px-0 pt-0">
            <CardTitle>User Terbaru</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada user</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="hidden lg:table-cell">Plan</TableHead>
                      <TableHead className="hidden sm:table-cell">Bergabung</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name || "No Name"}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {user.email || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.subscription ? (
                            <Badge variant="outline">{user.subscription.plan_name}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Free</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(user.created_at).toLocaleDateString("id-ID")}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
