import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, TrendingUp, TrendingDown, Users, Calendar, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface SubscriptionData {
  activeSubscriptions: number;
  newSubscriptions: number;
  canceledSubscriptions: number;
  expiringSubscriptions: number;
  renewalRate: number;
  churnRate: number;
  averageLifetime: number;
  ltv: number;
  subscriptionsByPlan: Array<{ plan: string; count: number; revenue: number }>;
  subscriptionTrend: Array<{ month: string; active: number; new: number; canceled: number }>;
  expiringList: Array<{ user_name: string; plan_name: string; expires_at: string }>;
}

export const AdminSubscriptionAnalytics = () => {
  const [data, setData] = useState<SubscriptionData>({
    activeSubscriptions: 0,
    newSubscriptions: 0,
    canceledSubscriptions: 0,
    expiringSubscriptions: 0,
    renewalRate: 0,
    churnRate: 0,
    averageLifetime: 0,
    ltv: 0,
    subscriptionsByPlan: [],
    subscriptionTrend: [],
    expiringList: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionData();
  }, []);

  const fetchSubscriptionData = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

      // Active subscriptions
      const { count: activeSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      // New subscriptions (last 30 days)
      const { count: newSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo);

      // Canceled subscriptions (last 30 days)
      const { count: canceledSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "canceled")
        .gte("updated_at", thirtyDaysAgo);

      // Expiring subscriptions (next 30 days)
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: expiringData, count: expiringSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("*, profiles(full_name), plans(name, price)")
        .eq("status", "active")
        .lte("expires_at", thirtyDaysLater)
        .order("expires_at", { ascending: true })
        .limit(10);

      const expiringList = expiringData?.map((sub: any) => ({
        user_name: sub.profiles?.full_name || "Unknown",
        plan_name: sub.plans?.name || "Unknown",
        expires_at: sub.expires_at
      })) || [];

      // Churn rate calculation
      const { count: previousActive } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active")
        .lte("created_at", thirtyDaysAgo);

      const churnRate = previousActive && previousActive > 0
        ? ((canceledSubscriptions || 0) / previousActive) * 100
        : 0;

      // Renewal rate (inverse of churn)
      const renewalRate = 100 - churnRate;

      // Subscriptions by plan
      const { data: planSubs } = await supabase
        .from("user_subscriptions")
        .select("plan_id, plans(name, price)")
        .eq("status", "active");

      const planCounts = planSubs?.reduce((acc: any, sub: any) => {
        const planName = sub.plans?.name || "Unknown";
        const price = Number(sub.plans?.price) || 0;
        if (!acc[planName]) {
          acc[planName] = { count: 0, revenue: 0 };
        }
        acc[planName].count += 1;
        acc[planName].revenue += price;
        return acc;
      }, {});

      const subscriptionsByPlan = Object.entries(planCounts || {}).map(([plan, data]: [string, any]) => ({
        plan,
        count: data.count,
        revenue: data.revenue
      }));

      // Average lifetime (simplified - days from creation to now for active subs)
      const { data: activeSubs } = await supabase
        .from("user_subscriptions")
        .select("created_at")
        .eq("status", "active");

      const totalDays = activeSubs?.reduce((sum, sub) => {
        const days = Math.floor((Date.now() - new Date(sub.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return sum + days;
      }, 0) || 0;

      const averageLifetime = activeSubs && activeSubs.length > 0
        ? totalDays / activeSubs.length
        : 0;

      // LTV = Average revenue per user * average lifetime in months
      const totalRevenue = subscriptionsByPlan.reduce((sum, p) => sum + p.revenue, 0);
      const avgRevenuePerUser = activeSubscriptions ? totalRevenue / activeSubscriptions : 0;
      const ltv = avgRevenuePerUser * (averageLifetime / 30);

      // Subscription trend (last 6 months)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthName = monthStart.toLocaleDateString("id-ID", { month: "short" });

        const { count: activeCount } = await supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .lte("created_at", monthEnd.toISOString());

        const { count: newCount } = await supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthStart.toISOString())
          .lt("created_at", monthEnd.toISOString());

        const { count: canceledCount } = await supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "canceled")
          .gte("updated_at", monthStart.toISOString())
          .lt("updated_at", monthEnd.toISOString());

        months.push({
          month: monthName,
          active: activeCount || 0,
          new: newCount || 0,
          canceled: canceledCount || 0
        });
      }

      setData({
        activeSubscriptions: activeSubscriptions || 0,
        newSubscriptions: newSubscriptions || 0,
        canceledSubscriptions: canceledSubscriptions || 0,
        expiringSubscriptions: expiringSubscriptions || 0,
        renewalRate,
        churnRate,
        averageLifetime,
        ltv,
        subscriptionsByPlan,
        subscriptionTrend: months,
        expiringList
      });
    } catch (error) {
      console.error("Error fetching subscription data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading subscription analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <CreditCard className="w-8 h-8 text-primary" />
            Subscription Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track subscription metrics, retention, and lifetime value
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.activeSubscriptions}</div>
              <p className="text-xs text-green-500 mt-1">
                +{data.newSubscriptions} new this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Renewal Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {data.renewalRate.toFixed(1)}%
              </div>
              <Progress value={data.renewalRate} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Churn Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.churnRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.canceledSubscriptions} canceled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Avg Lifetime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Math.round(data.averageLifetime)} days
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                LTV: Rp {Math.round(data.ltv).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscriptions by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscriptions by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.subscriptionsByPlan.map((plan) => (
                <div key={plan.plan}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-medium">{plan.plan}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.count} subscribers • Rp {plan.revenue.toLocaleString()}/mo
                      </p>
                    </div>
                    <Badge variant="outline">
                      {((plan.count / data.activeSubscriptions) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress 
                    value={(plan.count / data.activeSubscriptions) * 100} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Subscription Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.subscriptionTrend.map((item) => (
                <div key={item.month} className="grid grid-cols-4 gap-2 items-center">
                  <span className="text-sm font-medium">{item.month}</span>
                  <div className="text-sm text-muted-foreground">
                    <span className="text-green-500">+{item.new}</span> new
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <span className="text-destructive">-{item.canceled}</span> canceled
                  </div>
                  <div className="text-sm font-medium text-right">
                    {item.active} active
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Expiring Subscriptions Alert */}
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              Expiring Soon ({data.expiringSubscriptions})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.expiringList.map((sub, index) => (
                <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">{sub.user_name}</p>
                    <p className="text-xs text-muted-foreground">{sub.plan_name}</p>
                  </div>
                  <Badge variant="outline" className="text-orange-500 border-orange-500">
                    {new Date(sub.expires_at).toLocaleDateString("id-ID")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptionAnalytics;
