import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Calendar, CreditCard } from "lucide-react";
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

interface RevenueData {
  totalRevenue: number;
  monthlyRevenue: number;
  averageOrderValue: number;
  totalTransactions: number;
  mrr: number;
  revenueGrowth: number;
  topPlans: { plan: string; revenue: number; count: number }[];
  recentTransactions: Array<{
    id: string;
    amount: number;
    plan_name: string;
    created_at: string;
    payment_method: string;
  }>;
}

export const AdminRevenue = () => {
  const [data, setData] = useState<RevenueData>({
    totalRevenue: 0,
    monthlyRevenue: 0,
    averageOrderValue: 0,
    totalTransactions: 0,
    mrr: 0,
    revenueGrowth: 0,
    topPlans: [],
    recentTransactions: []
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  useEffect(() => {
    fetchRevenueData();
  }, [period]);

  const fetchRevenueData = async () => {
    try {
      const daysAgo = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString();
      const previousPeriodStart = new Date(Date.now() - Number(period) * 2 * 24 * 60 * 60 * 1000).toISOString();

      // Total revenue (all time)
      const { data: allPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid");

      const totalRevenue = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Period revenue
      const { data: periodPayments } = await supabase
        .from("payments")
        .select("amount, created_at, payment_method, id, plans(name)")
        .eq("status", "paid")
        .gte("created_at", daysAgo);

      const monthlyRevenue = periodPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const totalTransactions = periodPayments?.length || 0;
      const averageOrderValue = totalTransactions > 0 ? monthlyRevenue / totalTransactions : 0;

      // Previous period revenue for growth calculation
      const { data: previousPayments } = await supabase
        .from("payments")
        .select("amount")
        .eq("status", "paid")
        .gte("created_at", previousPeriodStart)
        .lt("created_at", daysAgo);

      const previousRevenue = previousPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      const revenueGrowth = previousRevenue > 0 
        ? ((monthlyRevenue - previousRevenue) / previousRevenue) * 100 
        : 0;

      // MRR (Monthly Recurring Revenue) - active subscriptions
      const { data: activeSubscriptions } = await supabase
        .from("user_subscriptions")
        .select("plans(price)")
        .eq("status", "active");

      const mrr = activeSubscriptions?.reduce((sum, sub: any) => 
        sum + (Number(sub.plans?.price) || 0), 0
      ) || 0;

      // Top plans by revenue
      const planRevenue = periodPayments?.reduce((acc: any, payment: any) => {
        const plan = payment.plans?.name || "Unknown";
        if (!acc[plan]) {
          acc[plan] = { revenue: 0, count: 0 };
        }
        acc[plan].revenue += Number(payment.amount);
        acc[plan].count += 1;
        return acc;
      }, {});

      const topPlans = Object.entries(planRevenue || {})
        .map(([plan, data]: [string, any]) => ({
          plan,
          revenue: data.revenue,
          count: data.count
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Recent transactions
      const recentTransactions = periodPayments
        ?.slice(0, 10)
        .map((p: any) => ({
          id: p.id,
          amount: Number(p.amount),
          plan_name: p.plans?.name || "Unknown",
          created_at: p.created_at,
          payment_method: p.payment_method
        })) || [];

      setData({
        totalRevenue,
        monthlyRevenue,
        averageOrderValue,
        totalTransactions,
        mrr,
        revenueGrowth,
        topPlans,
        recentTransactions
      });
    } catch (error) {
      console.error("Error fetching revenue data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading revenue data...</p>
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
              <DollarSign className="w-8 h-8 text-primary" />
              Revenue Analytics
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Track financial performance and revenue trends
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
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Period Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {data.monthlyRevenue.toLocaleString()}
              </div>
              <div className="flex items-center gap-1 mt-1">
                {data.revenueGrowth > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-destructive" />
                )}
                <span className={`text-xs ${data.revenueGrowth > 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {data.revenueGrowth > 0 ? '+' : ''}{data.revenueGrowth.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {data.mrr.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Monthly recurring revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Avg Order Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {data.averageOrderValue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.totalTransactions} transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Top Plans */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Revenue Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topPlans.map((plan) => (
                <div key={plan.plan} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{plan.plan}</p>
                    <p className="text-xs text-muted-foreground">{plan.count} purchases</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Rp {plan.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {((plan.revenue / data.monthlyRevenue) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.recentTransactions.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{transaction.plan_name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {transaction.payment_method}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleDateString("id-ID")}
                      </span>
                    </div>
                  </div>
                  <p className="font-bold text-primary">
                    Rp {transaction.amount.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminRevenue;
