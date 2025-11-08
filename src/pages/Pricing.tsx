import { useState, useEffect, startTransition } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  max_devices: number;
  max_contacts: number;
  max_broadcasts: number;
  features: string[];
  is_active: boolean;
}

export default function Pricing() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;

      startTransition(() => {
        setPlans((data || []).map(plan => ({
          ...plan,
          features: Array.isArray(plan.features) ? plan.features as string[] : []
        })));
      });
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Gagal memuat paket");
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setProcessingPlanId(planId);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Anda harus login terlebih dahulu");
        navigate("/auth");
        return;
      }

      // Create transaction via edge function
      const { data, error } = await supabase.functions.invoke('pakasir-create-transaction', {
        body: {
          plan_id: planId,
          payment_method: 'qris'
        }
      });

      if (error) throw error;

      console.log('Transaction created:', data);
      
      // Navigate to payment page with transaction details
      navigate('/payment', { 
        state: { 
          payment: data.payment,
          pakasir: data.pakasir
        } 
      });
      
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast.error("Gagal membuat transaksi");
    } finally {
      setProcessingPlanId(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Paket Berlangganan</h1>
          <p className="text-muted-foreground">
            Pilih paket yang sesuai dengan kebutuhan bisnis Anda
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6 space-y-6 transition-all duration-300 ease-in-out hover:shadow-lg">
              <div>
                <h3 className="text-2xl font-bold">{plan.name}</h3>
                {plan.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {plan.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold">
                    Rp {plan.price.toLocaleString('id-ID')}
                  </span>
                  <span className="text-muted-foreground">/bulan</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Device</span>
                  <Badge variant="secondary">{plan.max_devices}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Kontak</span>
                  <Badge variant="secondary">{plan.max_contacts.toLocaleString('id-ID')}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Broadcast/bulan</span>
                  <Badge variant="secondary">{plan.max_broadcasts.toLocaleString('id-ID')}</Badge>
                </div>
              </div>

              {plan.features && plan.features.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Fitur:</p>
                  <ul className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleSelectPlan(plan.id)}
                disabled={processingPlanId === plan.id}
              >
                {processingPlanId === plan.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Memproses...
                  </>
                ) : (
                  "Pilih Paket"
                )}
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
}