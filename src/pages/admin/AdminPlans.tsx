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
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

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
    price: "",
    max_devices: "",
    max_contacts: "",
    max_broadcasts: "",
    features: {
      broadcast_scheduling: false,
      csv_import: false,
      webhook_integration: false,
      api_access: false,
      priority_support: false,
      custom_templates: false,
      multi_device: false,
      chatbot: false,
    },
    is_active: true,
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
      const selectedFeatures = Object.entries(formData.features)
        .filter(([_, enabled]) => enabled)
        .map(([feature]) => feature);

      const planData = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        max_devices: parseInt(formData.max_devices),
        max_contacts: parseInt(formData.max_contacts),
        max_broadcasts: parseInt(formData.max_broadcasts),
        features: selectedFeatures,
        is_active: formData.is_active,
      };

      if (editingPlan) {
        await supabase
          .from("plans")
          .update(planData)
          .eq("id", editingPlan.id);
        toast.success("Plan berhasil diupdate");
      } else {
        await supabase
          .from("plans")
          .insert([planData]);
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
    
    const featuresObj = {
      broadcast_scheduling: false,
      csv_import: false,
      webhook_integration: false,
      api_access: false,
      priority_support: false,
      custom_templates: false,
      multi_device: false,
      chatbot: false,
    };

    if (Array.isArray(plan.features)) {
      (plan.features as string[]).forEach((feature) => {
        if (feature in featuresObj) {
          featuresObj[feature as keyof typeof featuresObj] = true;
        }
      });
    }

    setFormData({
      name: plan.name,
      description: plan.description || "",
      price: plan.price.toString(),
      max_devices: plan.max_devices.toString(),
      max_contacts: plan.max_contacts.toString(),
      max_broadcasts: plan.max_broadcasts.toString(),
      features: featuresObj,
      is_active: plan.is_active,
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
    setFormData({
      name: "",
      description: "",
      price: "",
      max_devices: "",
      max_contacts: "",
      max_broadcasts: "",
      features: {
        broadcast_scheduling: false,
        csv_import: false,
        webhook_integration: false,
        api_access: false,
        priority_support: false,
        custom_templates: false,
        multi_device: false,
        chatbot: false,
      },
      is_active: true,
    });
    setEditingPlan(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kelola Plan</h1>
            <p className="text-muted-foreground mt-2">
              Manage subscription plans dan features
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
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPlan ? "Edit Plan" : "Tambah Plan Baru"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  <div className="grid gap-4">
                    <div>
                      <Label htmlFor="name">Nama Plan</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Professional"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Deskripsi</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe the plan features..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">Harga (Rp)</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                        placeholder="0"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">Limitasi Plan</Label>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max_devices" className="text-sm font-normal">
                          Maximum Devices
                        </Label>
                        <Input
                          id="max_devices"
                          type="number"
                          value={formData.max_devices}
                          onChange={(e) => setFormData({ ...formData, max_devices: e.target.value })}
                          placeholder="1"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_contacts" className="text-sm font-normal">
                          Maximum Contacts
                        </Label>
                        <Input
                          id="max_contacts"
                          type="number"
                          value={formData.max_contacts}
                          onChange={(e) => setFormData({ ...formData, max_contacts: e.target.value })}
                          placeholder="100"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="max_broadcasts" className="text-sm font-normal">
                          Maximum Broadcasts per Month
                        </Label>
                        <Input
                          id="max_broadcasts"
                          type="number"
                          value={formData.max_broadcasts}
                          onChange={(e) => setFormData({ ...formData, max_broadcasts: e.target.value })}
                          placeholder="10"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base">Fitur Plan</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="broadcast_scheduling"
                          checked={formData.features.broadcast_scheduling}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, broadcast_scheduling: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="broadcast_scheduling" className="font-normal cursor-pointer flex-1">
                          Broadcast Scheduling
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="csv_import"
                          checked={formData.features.csv_import}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, csv_import: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="csv_import" className="font-normal cursor-pointer flex-1">
                          CSV Import Contacts
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="webhook_integration"
                          checked={formData.features.webhook_integration}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, webhook_integration: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="webhook_integration" className="font-normal cursor-pointer flex-1">
                          Webhook Integration
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="api_access"
                          checked={formData.features.api_access}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, api_access: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="api_access" className="font-normal cursor-pointer flex-1">
                          API Access
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="priority_support"
                          checked={formData.features.priority_support}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, priority_support: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="priority_support" className="font-normal cursor-pointer flex-1">
                          Priority Support
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="custom_templates"
                          checked={formData.features.custom_templates}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, custom_templates: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="custom_templates" className="font-normal cursor-pointer flex-1">
                          Custom Templates
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="multi_device"
                          checked={formData.features.multi_device}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, multi_device: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="multi_device" className="font-normal cursor-pointer flex-1">
                          Multi-Device Support
                        </Label>
                      </div>

                      <div className="flex items-center space-x-3 rounded-lg border p-3">
                        <Checkbox
                          id="chatbot"
                          checked={formData.features.chatbot}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              features: { ...formData.features, chatbot: checked as boolean },
                            })
                          }
                        />
                        <Label htmlFor="chatbot" className="font-normal cursor-pointer flex-1">
                          AI Chatbot
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_active" className="text-base cursor-pointer">
                        Plan Aktif
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Plan ini akan ditampilkan kepada user
                      </p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    {editingPlan ? "Update Plan" : "Tambah Plan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan) => (
                <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          {plan.name}
                          {plan.is_active && (
                            <Badge variant="default" className="text-xs">Active</Badge>
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-3xl font-bold">
                          Rp {plan.price.toLocaleString("id-ID")}
                        </p>
                        <p className="text-sm text-muted-foreground">per bulan</p>
                      </div>

                      <div className="space-y-2 py-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Max Devices:</span>
                          <span className="font-medium">{plan.max_devices}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Max Contacts:</span>
                          <span className="font-medium">{plan.max_contacts.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Max Broadcasts:</span>
                          <span className="font-medium">{plan.max_broadcasts}</span>
                        </div>
                      </div>

                      {Array.isArray(plan.features) && plan.features.length > 0 && (
                        <div className="space-y-2 py-4 border-t">
                          <p className="text-sm font-medium">Features:</p>
                          <div className="space-y-1">
                            {(plan.features as string[]).map((feature, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Check className="w-4 h-4 text-green-500" />
                                <span className="capitalize">
                                  {feature.replace(/_/g, " ")}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(plan)}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDelete(plan.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminPlans;
