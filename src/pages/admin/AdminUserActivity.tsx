import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, MessageSquare, Calendar, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActivityData {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsers: number;
  avgMessagesPerUser: number;
  avgDevicesPerUser: number;
  engagementRate: number;
  topActiveUsers: Array<{
    name: string;
    email: string;
    messageCount: number;
    deviceCount: number;
    lastActive: string;
  }>;
  activityByHour: { hour: number; count: number }[];
}

export const AdminUserActivity = () => {
  const [data, setData] = useState<ActivityData>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    newUsers: 0,
    avgMessagesPerUser: 0,
    avgDevicesPerUser: 0,
    engagementRate: 0,
    topActiveUsers: [],
    activityByHour: []
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchActivityData();
  }, [period]);

  const fetchActivityData = async () => {
    try {
      const daysAgo = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString();

      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Active users (with subscriptions)
      const { count: activeUsers } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const inactiveUsers = (totalUsers || 0) - (activeUsers || 0);

      // New users in period
      const { count: newUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", daysAgo);

      // Total messages
      const { count: totalMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true })
        .gte("created_at", daysAgo);

      // Total devices
      const { count: totalDevices } = await supabase
        .from("devices")
        .select("*", { count: "exact", head: true });

      const avgMessagesPerUser = totalUsers ? (totalMessages || 0) / totalUsers : 0;
      const avgDevicesPerUser = totalUsers ? (totalDevices || 0) / totalUsers : 0;
      
      // Engagement rate (users with messages / total users)
      const { data: usersWithMessages } = await supabase
        .from("message_history")
        .select("user_id")
        .gte("created_at", daysAgo);

      const uniqueActiveUsers = new Set(usersWithMessages?.map(m => m.user_id)).size;
      const engagementRate = totalUsers ? (uniqueActiveUsers / totalUsers) * 100 : 0;

      // Top active users
      const { data: messages } = await supabase
        .from("message_history")
        .select("user_id")
        .gte("created_at", daysAgo);

      const userMessageCounts = messages?.reduce((acc: any, msg) => {
        acc[msg.user_id] = (acc[msg.user_id] || 0) + 1;
        return acc;
      }, {});

      const topUserIds = Object.entries(userMessageCounts || {})
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)
        .map(([userId]) => userId);

      const { data: topUsers } = await supabase
        .from("profiles")
        .select("id, full_name, email, updated_at")
        .in("id", topUserIds);

      const { data: userDevices } = await supabase
        .from("devices")
        .select("user_id")
        .in("user_id", topUserIds);

      const deviceCounts = userDevices?.reduce((acc: any, device) => {
        acc[device.user_id] = (acc[device.user_id] || 0) + 1;
        return acc;
      }, {});

      const topActiveUsers = topUsers?.map(user => ({
        name: user.full_name || "Unknown",
        email: user.email || "N/A",
        messageCount: userMessageCounts?.[user.id] || 0,
        deviceCount: deviceCounts?.[user.id] || 0,
        lastActive: user.updated_at
      })) || [];

      // Activity by hour
      const { data: recentMessages } = await supabase
        .from("message_history")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const hourCounts = recentMessages?.reduce((acc: any, msg) => {
        const hour = new Date(msg.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {});

      const activityByHour = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: hourCounts?.[i] || 0
      }));

      setData({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        inactiveUsers,
        newUsers: newUsers || 0,
        avgMessagesPerUser,
        avgDevicesPerUser,
        engagementRate,
        topActiveUsers,
        activityByHour
      });
    } catch (error) {
      console.error("Error fetching activity data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading activity data...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Activity className="w-8 h-8 text-primary" />
              User Activity Analytics
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Monitor user engagement and activity patterns
            </p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalUsers}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="default" className="text-xs">
                  {data.activeUsers} active
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {data.inactiveUsers} inactive
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                New Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.newUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Last {period} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Avg Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.avgMessagesPerUser.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Per user
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Engagement Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.engagementRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active users
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Activity by Hour */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Activity by Hour (Last 24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-1 h-32">
              {data.activityByHour.map((item) => {
                const maxCount = Math.max(...data.activityByHour.map(d => d.count));
                const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                return (
                  <div key={item.hour} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-primary rounded-t hover:bg-primary/80 transition-colors cursor-pointer"
                      style={{ height: `${height}%`, minHeight: item.count > 0 ? '4px' : '0' }}
                      title={`${item.hour}:00 - ${item.count} messages`}
                    />
                    {item.hour % 3 === 0 && (
                      <span className="text-xs text-muted-foreground">
                        {item.hour}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topActiveUsers.map((user, index) => (
                <div key={user.email} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{user.messageCount} msgs</Badge>
                      <Badge variant="outline">{user.deviceCount} devices</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(user.lastActive).toLocaleDateString("id-ID")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminUserActivity;
