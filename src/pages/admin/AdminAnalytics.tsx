import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, LineChart, PieChart, TrendingUp, Users, MessageSquare, DollarSign } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalRevenue: number;
  growthRate: number;
  usersByPlan: { plan: string; count: number }[];
  messagesByDay: { day: string; count: number }[];
  revenueByMonth: { month: string; amount: number }[];
}

export const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    totalRevenue: 0,
    growthRate: 0,
    usersByPlan: [],
    messagesByDay: [],
    revenueByMonth: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // Total users
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Active subscriptions
      const { count: activeUsers } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // Total messages
      const { count: totalMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true });

      // Total revenue
      const { data: payments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid");

      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Users by plan
      const { data: subscriptions } = await supabase
        .from("user_subscriptions")
        .select("plan_id, plans(name)")
        .eq("status", "active");

      const planCounts = subscriptions?.reduce((acc: any, sub: any) => {
        const planName = sub.plans?.name || "Unknown";
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {});

      const usersByPlan = Object.entries(planCounts || {}).map(([plan, count]) => ({
        plan,
        count: count as number
      }));

      // Messages by day (last 7 days)
      const { data: messages } = await supabase
        .from("message_history")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const messageCounts = messages?.reduce((acc: any, msg) => {
        const day = new Date(msg.created_at).toLocaleDateString("id-ID", { weekday: "short" });
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      const messagesByDay = Object.entries(messageCounts || {}).map(([day, count]) => ({
        day,
        count: count as number
      }));

      // Revenue by month (last 6 months)
      const { data: revenueData } = await supabase
        .from("payments")
        .select("amount, created_at")
        .eq("status", "paid")
        .gte("created_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString());

      const revenueCounts = revenueData?.reduce((acc: any, payment) => {
        const month = new Date(payment.created_at).toLocaleDateString("id-ID", { month: "short" });
        acc[month] = (acc[month] || 0) + Number(payment.amount);
        return acc;
      }, {});

      const revenueByMonth = Object.entries(revenueCounts || {}).map(([month, amount]) => ({
        month,
        amount: amount as number
      }));

      // Calculate growth rate (comparing last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      const { count: recentUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      const { count: previousUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sixtyDaysAgo)
        .lt("created_at", thirtyDaysAgo);

      const growthRate = previousUsers ? ((recentUsers || 0) - (previousUsers || 0)) / previousUsers * 100 : 0;

      setData({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalMessages: totalMessages || 0,
        totalRevenue,
        growthRate,
        usersByPlan,
        messagesByDay,
        revenueByMonth
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart className="w-8 h-8 text-primary" />
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Comprehensive insights into your platform performance
          </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                {data.activeUsers} active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Messages Sent
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time messages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {data.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Lifetime revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Growth Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                {data.growthRate > 0 ? "+" : ""}{data.growthRate.toFixed(1)}%
                <Badge variant={data.growthRate > 0 ? "default" : "secondary"}>
                  30 days
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                User growth
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Users by Plan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.usersByPlan.map((item) => (
                    <div key={item.plan} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <span className="text-sm">{item.plan}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.count} users</span>
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${(item.count / data.totalUsers) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="messages" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Messages (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.messagesByDay.map((item) => (
                    <div key={item.day} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.day}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {item.count.toLocaleString()}
                        </span>
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${(item.count / Math.max(...data.messagesByDay.map(d => d.count))) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue (Last 6 Months)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.revenueByMonth.map((item) => (
                    <div key={item.month} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{item.month}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Rp {item.amount.toLocaleString()}
                        </span>
                        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{
                              width: `${(item.amount / Math.max(...data.revenueByMonth.map(d => d.amount))) * 100}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminAnalytics;
