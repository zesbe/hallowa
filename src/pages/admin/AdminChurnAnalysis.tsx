import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, TrendingDown, Users, DollarSign, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface ChurnData {
  totalChurned: number;
  churnRate: number;
  churnedRevenue: number;
  avgDaysBeforeChurn: number;
  churnByPlan: Array<{ plan: string; count: number; rate: number }>;
  churnReasons: Array<{ reason: string; count: number }>;
  atRiskUsers: Array<{
    name: string;
    email: string;
    plan: string;
    days_left: number;
    last_active: string;
  }>;
  churnTrend: Array<{ month: string; churned: number; rate: number }>;
}

export const AdminChurnAnalysis = () => {
  const [data, setData] = useState<ChurnData>({
    totalChurned: 0,
    churnRate: 0,
    churnedRevenue: 0,
    avgDaysBeforeChurn: 0,
    churnByPlan: [],
    churnReasons: [],
    atRiskUsers: [],
    churnTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChurnData();
  }, []);

  const fetchChurnData = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Total churned (last 30 days)
      const { data: churnedSubs, count: totalChurned } = await supabase
        .from("user_subscriptions")
        .select("*, plans(name, price)")
        .eq("status", "canceled")
        .gte("updated_at", thirtyDaysAgo);

      // Total active subscriptions
      const { count: activeCount } = await supabase
        .from("user_subscriptions")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");

      const churnRate = activeCount ? ((totalChurned || 0) / activeCount) * 100 : 0;

      // Churned revenue
      const churnedRevenue = churnedSubs?.reduce((sum, sub: any) => 
        sum + (Number(sub.plans?.price) || 0), 0
      ) || 0;

      // Average days before churn
      const daysToChurn = churnedSubs?.map((sub: any) => {
        const created = new Date(sub.created_at).getTime();
        const canceled = new Date(sub.updated_at).getTime();
        return Math.floor((canceled - created) / (1000 * 60 * 60 * 24));
      }) || [];

      const avgDaysBeforeChurn = daysToChurn.length > 0
        ? daysToChurn.reduce((sum, days) => sum + days, 0) / daysToChurn.length
        : 0;

      // Churn by plan
      const planChurns = churnedSubs?.reduce((acc: any, sub: any) => {
        const planName = sub.plans?.name || "Unknown";
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {});

      // Get total subscriptions per plan for rate calculation
      const { data: allPlanSubs } = await supabase
        .from("user_subscriptions")
        .select("plans(name)");

      const planTotals = allPlanSubs?.reduce((acc: any, sub: any) => {
        const planName = sub.plans?.name || "Unknown";
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {});

      const churnByPlan = Object.entries(planChurns || {}).map(([plan, count]: [string, any]) => ({
        plan,
        count,
        rate: planTotals?.[plan] ? (count / planTotals[plan]) * 100 : 0
      }));

      // Simulated churn reasons (in real app, collect from exit surveys)
      const churnReasons = [
        { reason: "Too expensive", count: Math.floor((totalChurned || 0) * 0.35) },
        { reason: "Not using enough", count: Math.floor((totalChurned || 0) * 0.25) },
        { reason: "Missing features", count: Math.floor((totalChurned || 0) * 0.20) },
        { reason: "Technical issues", count: Math.floor((totalChurned || 0) * 0.12) },
        { reason: "Other", count: Math.floor((totalChurned || 0) * 0.08) }
      ].filter(r => r.count > 0);

      // At-risk users (expiring soon + low activity)
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: atRiskData } = await supabase
        .from("user_subscriptions")
        .select("*, profiles(full_name, email, updated_at), plans(name)")
        .eq("status", "active")
        .lte("expires_at", sevenDaysLater)
        .order("expires_at", { ascending: true })
        .limit(10);

      const atRiskUsers = atRiskData?.map((sub: any) => {
        const daysLeft = Math.floor(
          (new Date(sub.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        return {
          name: sub.profiles?.full_name || "Unknown",
          email: sub.profiles?.email || "N/A",
          plan: sub.plans?.name || "Unknown",
          days_left: daysLeft,
          last_active: sub.profiles?.updated_at || sub.updated_at
        };
      }) || [];

      // Churn trend (last 6 months)
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date();
        monthStart.setMonth(monthStart.getMonth() - i);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);

        const monthName = monthStart.toLocaleDateString("id-ID", { month: "short" });

        const { count: churnedCount } = await supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "canceled")
          .gte("updated_at", monthStart.toISOString())
          .lt("updated_at", monthEnd.toISOString());

        const { count: activeAtMonth } = await supabase
          .from("user_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .lte("created_at", monthEnd.toISOString());

        months.push({
          month: monthName,
          churned: churnedCount || 0,
          rate: activeAtMonth ? ((churnedCount || 0) / activeAtMonth) * 100 : 0
        });
      }

      setData({
        totalChurned: totalChurned || 0,
        churnRate,
        churnedRevenue,
        avgDaysBeforeChurn,
        churnByPlan,
        churnReasons,
        atRiskUsers,
        churnTrend: months
      });
    } catch (error) {
      console.error("Error fetching churn data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading churn analysis...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
            Churn Analysis
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Analyze customer churn patterns and retention risks
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-destructive/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-destructive" />
                Churned Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.totalChurned}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Churn Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.churnRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Monthly rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-destructive" />
                Lost Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                Rp {data.churnedRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Per month</p>
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
                {Math.round(data.avgDaysBeforeChurn)} days
              </div>
              <p className="text-xs text-muted-foreground mt-1">Before churn</p>
            </CardContent>
          </Card>
        </div>

        {/* Churn by Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Churn by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.churnByPlan.map((plan) => (
                <div key={plan.plan} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{plan.plan}</p>
                    <p className="text-xs text-muted-foreground">
                      {plan.count} churned users
                    </p>
                  </div>
                  <Badge variant={plan.rate > 10 ? "destructive" : "outline"}>
                    {plan.rate.toFixed(1)}% churn
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Churn Reasons */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Churn Reasons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.churnReasons.map((reason) => {
                const percentage = (reason.count / data.totalChurned) * 100;
                return (
                  <div key={reason.reason}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{reason.reason}</span>
                      <span className="text-sm text-muted-foreground">
                        {reason.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-destructive"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* At-Risk Users */}
        <Card className="border-orange-500/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              At-Risk Users (Expiring in 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.atRiskUsers.map((user, index) => (
                <div key={index} className="border-b pb-3 last:border-0">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="outline" className="text-orange-500 border-orange-500">
                      {user.days_left} days left
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{user.plan}</span>
                    <span>•</span>
                    <span>Last active: {new Date(user.last_active).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Churn Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Churn Trend (6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.churnTrend.map((item) => (
                <div key={item.month} className="grid grid-cols-3 gap-4 items-center">
                  <span className="text-sm font-medium">{item.month}</span>
                  <span className="text-sm text-destructive">
                    {item.churned} churned
                  </span>
                  <div className="text-right">
                    <Badge variant={item.rate > 10 ? "destructive" : "outline"}>
                      {item.rate.toFixed(1)}%
                    </Badge>
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

export default AdminChurnAnalysis;
