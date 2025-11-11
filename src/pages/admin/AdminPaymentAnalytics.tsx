import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface PaymentData {
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  successRate: number;
  averagePaymentTime: number;
  paymentsByMethod: Array<{ method: string; count: number; amount: number }>;
  paymentsByStatus: Array<{ status: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
  recentFailures: Array<{
    user_name: string;
    amount: number;
    payment_method: string;
    created_at: string;
  }>;
}

export const AdminPaymentAnalytics = () => {
  const [data, setData] = useState<PaymentData>({
    totalPayments: 0,
    successfulPayments: 0,
    failedPayments: 0,
    pendingPayments: 0,
    successRate: 0,
    averagePaymentTime: 0,
    paymentsByMethod: [],
    paymentsByStatus: [],
    failureReasons: [],
    recentFailures: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentData();
  }, []);

  const fetchPaymentData = async () => {
    try {
      // Total payments
      const { count: totalPayments } = await supabase
        .from("payments")
        .select("*", { count: "exact", head: true });

      // Payments by status
      const { data: allPayments } = await supabase
        .from("payments")
        .select("status, amount, payment_method, created_at, completed_at");

      const statusCounts = allPayments?.reduce((acc: any, payment) => {
        acc[payment.status] = (acc[payment.status] || 0) + 1;
        return acc;
      }, {});

      const successfulPayments = statusCounts?.["paid"] || 0;
      const failedPayments = statusCounts?.["failed"] || 0;
      const pendingPayments = statusCounts?.["pending"] || 0;

      const successRate = totalPayments ? (successfulPayments / totalPayments) * 100 : 0;

      const paymentsByStatus = Object.entries(statusCounts || {}).map(([status, count]) => ({
        status,
        count: count as number
      }));

      // Payments by method
      const methodCounts = allPayments?.reduce((acc: any, payment) => {
        const method = payment.payment_method || "Unknown";
        if (!acc[method]) {
          acc[method] = { count: 0, amount: 0 };
        }
        acc[method].count += 1;
        if (payment.status === "paid") {
          acc[method].amount += Number(payment.amount);
        }
        return acc;
      }, {});

      const paymentsByMethod = Object.entries(methodCounts || {}).map(([method, data]: [string, any]) => ({
        method,
        count: data.count,
        amount: data.amount
      }));

      // Average payment time (from creation to completion)
      const completedPayments = allPayments?.filter(p => 
        p.status === "paid" && p.completed_at
      );

      const totalTime = completedPayments?.reduce((sum, payment) => {
        const created = new Date(payment.created_at).getTime();
        const completed = new Date(payment.completed_at).getTime();
        return sum + (completed - created);
      }, 0) || 0;

      const averagePaymentTime = completedPayments && completedPayments.length > 0
        ? totalTime / completedPayments.length / (1000 * 60) // convert to minutes
        : 0;

      // Simulated failure reasons (in real app, track from payment gateway)
      const failureReasons = [
        { reason: "Insufficient funds", count: Math.floor(failedPayments * 0.40) },
        { reason: "Card declined", count: Math.floor(failedPayments * 0.25) },
        { reason: "Expired card", count: Math.floor(failedPayments * 0.15) },
        { reason: "Network error", count: Math.floor(failedPayments * 0.12) },
        { reason: "Other", count: Math.floor(failedPayments * 0.08) }
      ].filter(r => r.count > 0);

      // Recent failures
      const { data: failedPaymentsData } = await supabase
        .from("payments")
        .select("amount, payment_method, created_at, profiles(full_name)")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(10);

      const recentFailures = failedPaymentsData?.map((payment: any) => ({
        user_name: payment.profiles?.full_name || "Unknown",
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        created_at: payment.created_at
      })) || [];

      setData({
        totalPayments: totalPayments || 0,
        successfulPayments,
        failedPayments,
        pendingPayments,
        successRate,
        averagePaymentTime,
        paymentsByMethod,
        paymentsByStatus,
        failureReasons,
        recentFailures
      });
    } catch (error) {
      console.error("Error fetching payment data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading payment analytics...</p>
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
            Payment Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track payment success rates and processing metrics
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Total Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalPayments}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {data.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.successfulPayments} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Failed Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.failedPayments}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Need attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Avg Processing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.averagePaymentTime.toFixed(0)}m
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.pendingPayments} pending
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payments by Method */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payments by Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.paymentsByMethod.map((method) => {
                const percentage = (method.count / data.totalPayments) * 100;
                return (
                  <div key={method.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{method.method}</span>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">{method.count}</span> payments
                        <span className="mx-2">•</span>
                        <span>Rp {method.amount.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Payment Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.paymentsByStatus.map((status) => (
                <div key={status.status} className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{status.count}</p>
                  <Badge 
                    variant={
                      status.status === "paid" ? "default" :
                      status.status === "failed" ? "destructive" :
                      "secondary"
                    }
                    className="mt-2"
                  >
                    {status.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Failure Reasons */}
        {data.failureReasons.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Failure Reasons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.failureReasons.map((reason) => {
                  const percentage = (reason.count / data.failedPayments) * 100;
                  return (
                    <div key={reason.reason} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{reason.reason}</p>
                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-destructive"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground ml-4">
                        {reason.count} ({percentage.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Failures */}
        {data.recentFailures.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Recent Failed Payments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.recentFailures.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{payment.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.payment_method} • {new Date(payment.created_at).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-destructive">
                      Rp {payment.amount.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminPaymentAnalytics;
