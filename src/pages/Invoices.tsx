import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Download,
  Filter,
  Receipt,
  Calendar,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  CreditCard,
  FileText
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  plan_name: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_date: string | null;
  due_date: string | null;
  description: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  created_at: string;
}

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (user) {
      fetchInvoices();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("invoices")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      // Apply filters
      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }
      if (dateFrom) {
        query = query.gte("created_at", new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("created_at", new Date(dateTo).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);
    } catch (error: any) {
      console.error("Error fetching invoices:", error);
      toast.error("Gagal memuat invoice");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return;

    const channel = supabase
      .channel("invoices-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchInvoices(); // Refresh when invoice changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (user) {
      fetchInvoices();
    }
  }, [selectedStatus, dateFrom, dateTo]);

  const filteredInvoices = invoices.filter((invoice) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      invoice.invoice_number.toLowerCase().includes(search) ||
      invoice.plan_name.toLowerCase().includes(search) ||
      invoice.description?.toLowerCase().includes(search)
    );
  });

  const formatCurrency = (amount: number, currency: string = "IDR") => {
    if (currency === "IDR") {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR"
      }).format(amount);
    }
    return `${currency} ${amount.toFixed(2)}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "failed":
      case "cancelled":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "refunded":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
      refunded: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
    };

    const labels: Record<string, string> = {
      paid: "Lunas",
      pending: "Menunggu",
      failed: "Gagal",
      cancelled: "Dibatalkan",
      refunded: "Refund"
    };

    return (
      <Badge variant="secondary" className={variants[status] || ""}>
        {labels[status] || status}
      </Badge>
    );
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    try {
      // Generate simple invoice PDF (in real app, use proper PDF library)
      const invoiceText = `
INVOICE
${invoice.invoice_number}

Plan: ${invoice.plan_name}
Amount: ${formatCurrency(invoice.amount, invoice.currency)}
Status: ${invoice.status.toUpperCase()}
${invoice.payment_method ? `Payment Method: ${invoice.payment_method}` : ''}
${invoice.payment_date ? `Payment Date: ${format(new Date(invoice.payment_date), "dd MMMM yyyy", { locale: idLocale })}` : ''}

${invoice.description || ''}

${invoice.billing_period_start && invoice.billing_period_end ? `
Billing Period:
${format(new Date(invoice.billing_period_start), "dd MMM yyyy", { locale: idLocale })} - ${format(new Date(invoice.billing_period_end), "dd MMM yyyy", { locale: idLocale })}
` : ''}

Invoice Date: ${format(new Date(invoice.created_at), "dd MMMM yyyy HH:mm", { locale: idLocale })}

---
HalloWa WhatsApp Manager
      `.trim();

      const blob = new Blob([invoiceText], { type: "text/plain;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${invoice.invoice_number}.txt`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Invoice berhasil diunduh");
    } catch (error) {
      console.error("Error downloading invoice:", error);
      toast.error("Gagal mengunduh invoice");
    }
  };

  const totalPaid = filteredInvoices
    .filter(inv => inv.status === "paid")
    .reduce((sum, inv) => sum + inv.amount, 0);

  const totalPending = filteredInvoices
    .filter(inv => inv.status === "pending")
    .reduce((sum, inv) => sum + inv.amount, 0);

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🧾 Invoice & Pembayaran</h1>
        <p className="text-muted-foreground">
          Kelola invoice dan riwayat pembayaran Anda
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter & Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cari nomor invoice atau plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="paid">Lunas</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="failed">Gagal</SelectItem>
                <SelectItem value="cancelled">Dibatalkan</SelectItem>
                <SelectItem value="refunded">Refund</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Dari Tanggal"
            />

            {/* Date To */}
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Sampai Tanggal"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoice</p>
                <p className="text-2xl font-bold">{filteredInvoices.length}</p>
              </div>
              <Receipt className="w-8 h-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lunas</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredInvoices.filter(inv => inv.status === 'paid').length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Dibayar</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-yellow-600">
                  {formatCurrency(totalPending)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-muted-foreground">Memuat invoice...</p>
          </CardContent>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">Belum ada invoice</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <Card key={invoice.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-lg">{invoice.invoice_number}</h3>
                          {getStatusBadge(invoice.status)}
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          {invoice.plan_name}
                        </p>

                        {invoice.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {invoice.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <DollarSign className="w-4 h-4 text-muted-foreground" />
                            <span className="font-semibold text-primary">
                              {formatCurrency(invoice.amount, invoice.currency)}
                            </span>
                          </div>

                          {invoice.payment_method && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <CreditCard className="w-4 h-4" />
                              {invoice.payment_method}
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(invoice.created_at), "dd MMM yyyy", { locale: idLocale })}
                          </div>

                          {invoice.payment_date && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              Dibayar: {format(new Date(invoice.payment_date), "dd MMM yyyy", { locale: idLocale })}
                            </div>
                          )}

                          {invoice.due_date && invoice.status === 'pending' && (
                            <div className="flex items-center gap-1 text-yellow-600">
                              <AlertCircle className="w-4 h-4" />
                              Jatuh Tempo: {format(new Date(invoice.due_date), "dd MMM yyyy", { locale: idLocale })}
                            </div>
                          )}
                        </div>

                        {invoice.billing_period_start && invoice.billing_period_end && (
                          <div className="mt-2 text-xs text-muted-foreground bg-muted p-2 rounded">
                            📅 Periode Billing: {format(new Date(invoice.billing_period_start), "dd MMM yyyy", { locale: idLocale })} - {format(new Date(invoice.billing_period_end), "dd MMM yyyy", { locale: idLocale })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {getStatusIcon(invoice.status)}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadInvoice(invoice)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
