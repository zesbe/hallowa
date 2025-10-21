import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, Clock, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "react-qr-code";

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("pending");
  
  const { payment, pakasir } = location.state || {};

  useEffect(() => {
    if (!payment || !pakasir) {
      toast.error("Data pembayaran tidak ditemukan");
      navigate("/pricing");
    }
  }, [payment, pakasir, navigate]);

  useEffect(() => {
    // Check payment status every 5 seconds
    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, [payment]);

  const checkPaymentStatus = async () => {
    if (!payment) return;

    try {
      const { data, error } = await supabase
        .from("payments")
        .select("status")
        .eq("id", payment.id)
        .single();

      if (error) throw error;

      if (data.status === "completed") {
        setPaymentStatus("completed");
        toast.success("Pembayaran berhasil! Subscription Anda telah aktif");
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      }
    } catch (error) {
      console.error("Error checking payment status:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Berhasil disalin");
  };

  if (!payment || !pakasir) {
    return null;
  }

  const expiryTime = new Date(pakasir.expired_at).toLocaleString('id-ID');

  if (paymentStatus === "completed") {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
          <CheckCircle className="w-20 h-20 text-green-500" />
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold">Pembayaran Berhasil!</h2>
            <p className="text-muted-foreground">
              Subscription Anda telah aktif. Anda akan diarahkan ke dashboard...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Selesaikan Pembayaran</h1>
          <p className="text-muted-foreground">
            Scan QR Code atau transfer ke nomor Virtual Account
          </p>
        </div>

        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Pembayaran berlaku sampai: <strong>{expiryTime}</strong>
          </AlertDescription>
        </Alert>

        <Card className="p-6 space-y-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Order ID</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded">
                {payment.order_id}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(payment.order_id)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Pembayaran</p>
            <p className="text-3xl font-bold">
              Rp {pakasir.total_payment.toLocaleString('id-ID')}
            </p>
            <p className="text-sm text-muted-foreground">
              Termasuk biaya admin: Rp {pakasir.fee.toLocaleString('id-ID')}
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold">
              {pakasir.payment_method === 'qris' ? 'Scan QR Code:' : 'Nomor Virtual Account:'}
            </p>
            
            {pakasir.payment_method === 'qris' ? (
              <div className="flex justify-center bg-white p-4 rounded-lg">
                <QRCode value={pakasir.payment_number} size={256} />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-lg font-mono">
                  {pakasir.payment_number}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(pakasir.payment_number)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <p className="text-sm">Menunggu pembayaran...</p>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/pricing")} className="flex-1">
            Kembali ke Paket
          </Button>
          <Button onClick={checkPaymentStatus} disabled={checking} className="flex-1">
            {checking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Mengecek...
              </>
            ) : (
              "Cek Status Pembayaran"
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}