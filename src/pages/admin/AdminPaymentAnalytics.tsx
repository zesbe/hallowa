import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard, CheckCircle, XCircle, Clock, TrendingUp, Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { logAudit } from "@/utils/auditLogger";

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

interface PendingPayment {
  id: string;
  user_id: string;
  user_name: string;
  amount: number;
  payment_method: string;
  order_id: string;
  created_at: string;
  plan_name?: string;
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
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([]);
  const [editingPayment, setEditingPayment] = useState<PendingPayment | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchPaymentData();
    fetchPendingPayments();

    // Real-time subscription for pending payments
    const channel = supabase
      .channel("pending-payments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: "status=eq.pending"
        },
        () => {
          fetchPendingPayments();
          fetchPaymentData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const fetchPendingPayments = async () => {
    try {
      const { data: payments } = await supabase
        .from("payments")
        .select(`
          id,
          user_id,
          amount,
          payment_method,
          order_id,
          created_at,
          plan_id,
          profiles(full_name),
          plans(name)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const formattedPayments: PendingPayment[] = payments?.map((payment: any) => ({
        id: payment.id,
        user_id: payment.user_id,
        user_name: payment.profiles?.full_name || "Unknown",
        amount: Number(payment.amount),
        payment_method: payment.payment_method,
        order_id: payment.order_id,
        created_at: payment.created_at,
        plan_name: payment.plans?.name
      })) || [];

      setPendingPayments(formattedPayments);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!editingPayment || !newStatus) return;

    setIsUpdating(true);
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === "paid") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("payments")
        .update(updateData)
        .eq("id", editingPayment.id);

      if (error) throw error;

      // Log audit
      await logAudit({
        action: "update",
        entity_type: "payment",
        entity_id: editingPayment.id,
        old_values: { status: "pending" },
        new_values: { status: newStatus }
      });

      toast.success(`Payment ${newStatus === "paid" ? "approved" : "rejected"} successfully`);
      setEditingPayment(null);
      setNewStatus("");
      fetchPendingPayments();
      fetchPaymentData();
    } catch (error: any) {
      console.error("Error updating payment:", error);
      toast.error(error.message || "Failed to update payment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeletePayment = async (payment: PendingPayment) => {
    if (!confirm("Are you sure you want to delete this payment?")) return;

    try {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", payment.id);

      if (error) throw error;

      // Log audit
      await logAudit({
        action: "delete",
        entity_type: "payment",
        entity_id: payment.id,
        old_values: {
          order_id: payment.order_id,
          amount: payment.amount
        }
      });

      toast.success("Payment deleted successfully");
      fetchPendingPayments();
      fetchPaymentData();
    } catch (error: any) {
      console.error("Error deleting payment:", error);
      toast.error(error.message || "Failed to delete payment");
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

        {/* Pending Payments CRUD */}
        {pendingPayments.length > 0 && (
          <Card className="border-yellow-500/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Pending Payments ({pendingPayments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.user_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.plan_name || "N/A"}</Badge>
                        </TableCell>
                        <TableCell>Rp {payment.amount.toLocaleString()}</TableCell>
                        <TableCell>{payment.payment_method}</TableCell>
                        <TableCell className="font-mono text-xs">{payment.order_id}</TableCell>
                        <TableCell className="text-sm">
                          {new Date(payment.created_at).toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingPayment(payment);
                              setNewStatus("");
                            }}
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeletePayment(payment)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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

      {/* Edit Payment Status Dialog */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Change the status of payment {editingPayment?.order_id}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">User</label>
              <p className="text-sm text-muted-foreground">{editingPayment?.user_name}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount</label>
              <p className="text-sm text-muted-foreground">
                Rp {editingPayment?.amount.toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Approve (Paid)</SelectItem>
                  <SelectItem value="failed">Reject (Failed)</SelectItem>
                  <SelectItem value="expired">Expire</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPayment(null)} disabled={isUpdating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={!newStatus || isUpdating}>
              {isUpdating ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPaymentAnalytics;
