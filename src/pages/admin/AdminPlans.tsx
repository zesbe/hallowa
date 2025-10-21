import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  max_devices: number;
  max_contacts: number;
  max_broadcasts: number;
  features: string[];
  is_active: boolean;
}

export const AdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    max_devices: 1,
    max_contacts: 100,
    max_broadcasts: 10,
    features: "",
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      
      const plansData = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features as string[] : []
      }));
      
      setPlans(plansData);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Gagal memuat data plan");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const featuresArray = formData.features.split("\n").filter(f => f.trim());
      
      if (editingPlan) {
        const { error } = await supabase
          .from("plans")
          .update({
            name: formData.name,
            description: formData.description,
            price: formData.price,
            max_devices: formData.max_devices,
            max_contacts: formData.max_contacts,
            max_broadcasts: formData.max_broadcasts,
            features: featuresArray,
          })
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plan berhasil diupdate");
      } else {
        const { error } = await supabase
          .from("plans")
          .insert({
            name: formData.name,
            description: formData.description,
            price: formData.price,
            max_devices: formData.max_devices,
            max_contacts: formData.max_contacts,
            max_broadcasts: formData.max_broadcasts,
            features: featuresArray,
          });

        if (error) throw error;
        toast.success("Plan berhasil ditambahkan");
      }

      setDialogOpen(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Gagal menyimpan plan");
    }
  };

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price,
      max_devices: plan.max_devices,
      max_contacts: plan.max_contacts,
      max_broadcasts: plan.max_broadcasts,
      features: plan.features.join("\n"),
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus plan ini?")) return;

    try {
      const { error } = await supabase
        .from("plans")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Plan berhasil dihapus");
      fetchPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Gagal menghapus plan");
    }
  };

  const resetForm = () => {
    setEditingPlan(null);
    setFormData({
      name: "",
      description: "",
      price: 0,
      max_devices: 1,
      max_contacts: 100,
      max_broadcasts: 10,
      features: "",
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kelola Plan</h1>
            <p className="text-muted-foreground mt-2">
              Manage subscription plans
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPlan ? "Edit Plan" : "Tambah Plan Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Plan</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Harga (Rp)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="max_devices">Max Devices</Label>
                    <Input
                      id="max_devices"
                      type="number"
                      value={formData.max_devices}
                      onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_contacts">Max Contacts</Label>
                    <Input
                      id="max_contacts"
                      type="number"
                      value={formData.max_contacts}
                      onChange={(e) => setFormData({ ...formData, max_contacts: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_broadcasts">Max Broadcasts</Label>
                    <Input
                      id="max_broadcasts"
                      type="number"
                      value={formData.max_broadcasts}
                      onChange={(e) => setFormData({ ...formData, max_broadcasts: Number(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="features">Features (satu per baris)</Label>
                  <Textarea
                    id="features"
                    value={formData.features}
                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                    rows={5}
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingPlan ? "Update Plan" : "Tambah Plan"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <p>Loading...</p>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{plan.name}</span>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-2xl font-bold">
                      Rp {plan.price.toLocaleString("id-ID")}
                    </p>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                    <div className="space-y-1 text-sm">
                      <p>• {plan.max_devices} Devices</p>
                      <p>• {plan.max_contacts} Contacts</p>
                      <p>• {plan.max_broadcasts} Broadcasts/day</p>
                    </div>
                    <div className="border-t pt-2">
                      {plan.features.map((feature, idx) => (
                        <p key={idx} className="text-xs">✓ {feature}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPlans;
