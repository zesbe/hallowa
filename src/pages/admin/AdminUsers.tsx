import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, User, Mail, Calendar, Plus, Edit, Trash2, Crown } from "lucide-react";
import { z } from "zod";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserData {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  created_at: string;
  subscription?: {
    id: string;
    plan_id: string;
    plan_name: string;
    status: string;
    expires_at: string | null;
  } | null;
}

interface Plan {
  id: string;
  name: string;
  duration_months: number;
  price: number;
}

const userSchema = z.object({
  email: z.string().email("Email tidak valid").trim(),
  password: z.string().min(6, "Password minimal 6 karakter").optional(),
  full_name: z.string().min(1, "Nama harus diisi").trim(),
  role: z.enum(["user", "admin"]),
});

type UserFormData = z.infer<typeof userSchema>;

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: "",
    password: "",
    full_name: "",
    role: "user",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof UserFormData, string>>>({});
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false);
  const [managingUser, setManagingUser] = useState<UserData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [extendMonths, setExtendMonths] = useState<number>(1);

  useEffect(() => {
    fetchUsers();
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
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch all users with their profiles, roles, and subscriptions in one query
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          created_at
        `);

      if (profilesError) throw profilesError;
      if (!profiles) return;

      // Fetch all user roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Fetch all subscriptions with plans
      const { data: subscriptionsData } = await supabase
        .from("user_subscriptions")
        .select(`
          id,
          user_id,
          plan_id,
          status,
          expires_at,
          plans (
            name
          )
        `)
        .eq("status", "active");

      const usersData: UserData[] = profiles.map((profile) => {
        const roleData = rolesData?.find(r => r.user_id === profile.id);
        const subscriptionData = subscriptionsData?.find(s => s.user_id === profile.id);

        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email || "No email",
          role: roleData?.role || "user",
          created_at: profile.created_at,
          subscription: subscriptionData ? {
            id: subscriptionData.id,
            plan_id: subscriptionData.plan_id,
            plan_name: (subscriptionData.plans as any)?.name || "No Plan",
            status: subscriptionData.status,
            expires_at: subscriptionData.expires_at,
          } : null,
        };
      });

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Gagal memuat data users");
    } finally {
      setLoading(false);
    }
  };

  const callAdminFunction = async (action: string, payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const response = await fetch(
      `https://ierdfxgeectqoekugyvb.supabase.co/functions/v1/admin-user-management`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      }
    );

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Operation failed");
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    try {
      // Validate form
      const validatedData = userSchema.parse(formData);

      if (editingUser) {
        // Update user
        await callAdminFunction("update", {
          user_id: editingUser.id,
          email: validatedData.email,
          full_name: validatedData.full_name,
          role: validatedData.role,
        });
        toast.success("User berhasil diupdate");
      } else {
        // Create user
        if (!validatedData.password) {
          setFormErrors({ password: "Password harus diisi" });
          return;
        }
        await callAdminFunction("create", validatedData);
        toast.success("User berhasil dibuat");
      }

      setDialogOpen(false);
      resetForm();
      fetchUsers();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Partial<Record<keyof UserFormData, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            errors[err.path[0] as keyof UserFormData] = err.message;
          }
        });
        setFormErrors(errors);
      } else {
        toast.error(error instanceof Error ? error.message : "Gagal menyimpan user");
      }
    }
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      full_name: user.full_name || "",
      role: user.role as "user" | "admin",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan.")) {
      return;
    }

    try {
      await callAdminFunction("delete", { user_id: userId });
      toast.success("User berhasil dihapus");
      fetchUsers();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus user");
    }
  };

  const resetForm = () => {
    setFormData({
      email: "",
      password: "",
      full_name: "",
      role: "user",
    });
    setFormErrors({});
    setEditingUser(null);
  };

  const handleManageSubscription = (user: UserData) => {
    setManagingUser(user);
    if (user.subscription) {
      setSelectedPlan(user.subscription.plan_id);
    } else {
      setSelectedPlan(plans[0]?.id || "");
    }
    setExtendMonths(1);
    setSubscriptionDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    if (!managingUser || !selectedPlan) {
      toast.error("Pilih plan terlebih dahulu");
      return;
    }

    try {
      const plan = plans.find(p => p.id === selectedPlan);
      if (!plan) throw new Error("Plan tidak ditemukan");

      const durationMs = extendMonths * 30 * 24 * 60 * 60 * 1000;

      if (managingUser.subscription) {
        // Extend existing subscription
        const currentExpiry = managingUser.subscription.expires_at 
          ? new Date(managingUser.subscription.expires_at) 
          : new Date();
        const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
        const newExpiresAt = new Date(baseDate.getTime() + durationMs);

        const { error } = await supabase
          .from("user_subscriptions")
          .update({
            plan_id: selectedPlan,
            expires_at: newExpiresAt.toISOString(),
            status: 'active'
          })
          .eq("id", managingUser.subscription.id);

        if (error) throw error;
        toast.success(`Subscription berhasil diperpanjang hingga ${newExpiresAt.toLocaleDateString("id-ID")}`);
      } else {
        // Create new subscription
        const newExpiresAt = new Date(Date.now() + durationMs);

        const { error } = await supabase
          .from("user_subscriptions")
          .insert({
            user_id: managingUser.id,
            plan_id: selectedPlan,
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: newExpiresAt.toISOString(),
          });

        if (error) throw error;
        toast.success(`Subscription berhasil dibuat hingga ${newExpiresAt.toLocaleDateString("id-ID")}`);
      }

      setSubscriptionDialogOpen(false);
      setManagingUser(null);
      fetchUsers();
    } catch (error) {
      console.error("Error saving subscription:", error);
      toast.error("Gagal menyimpan subscription");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Kelola User</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage users dan permissions
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Tambah User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
                <DialogDescription>
                  {editingUser ? "Update informasi user" : "Buat akun user baru"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Nama Lengkap</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="John Doe"
                  />
                  {formErrors.full_name && (
                    <p className="text-sm text-destructive">{formErrors.full_name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                  {formErrors.email && (
                    <p className="text-sm text-destructive">{formErrors.email}</p>
                  )}
                </div>

                {!editingUser && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Min. 6 karakter"
                    />
                    {formErrors.password && (
                      <p className="text-sm text-destructive">{formErrors.password}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: "user" | "admin") => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                    Batal
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingUser ? "Update" : "Buat User"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar User</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[150px]">User</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead className="hidden lg:table-cell">Paket</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Masa Aktif</TableHead>
                        <TableHead className="hidden sm:table-cell">Terdaftar</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              user.role === "admin" ? "bg-orange-500" : "bg-blue-500"
                            }`}>
                              {user.role === "admin" ? (
                                <Shield className="w-4 h-4 text-white" />
                              ) : (
                                <User className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{user.full_name || "No Name"}</div>
                              <div className="text-xs text-muted-foreground md:hidden truncate">{user.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {user.subscription ? (
                            <Badge variant="outline">{user.subscription.plan_name}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">No Plan</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.subscription ? (
                            <Badge
                              variant={
                                user.subscription.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {user.subscription.status}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.subscription?.expires_at ? (
                            <div className="space-y-1">
                              <div className={`text-sm font-medium ${
                                new Date(user.subscription.expires_at) < new Date()
                                  ? "text-destructive"
                                  : new Date(user.subscription.expires_at) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                                  ? "text-orange-500"
                                  : ""
                              }`}>
                                {new Date(user.subscription.expires_at).toLocaleDateString("id-ID", {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </div>
                              {(() => {
                                const expiryDate = new Date(user.subscription.expires_at);
                                const today = new Date();
                                const daysRemaining = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                
                                if (daysRemaining < 0) {
                                  return (
                                    <Badge variant="destructive" className="text-xs">
                                      Kadaluarsa {Math.abs(daysRemaining)} hari lalu
                                    </Badge>
                                  );
                                } else if (daysRemaining <= 7) {
                                  return (
                                    <Badge variant="outline" className="text-xs border-orange-500 text-orange-500">
                                      {daysRemaining} hari lagi
                                    </Badge>
                                  );
                                } else {
                                  return (
                                    <Badge variant="secondary" className="text-xs">
                                      {daysRemaining} hari lagi
                                    </Badge>
                                  );
                                }
                              })()}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span className="whitespace-nowrap">{new Date(user.created_at).toLocaleDateString("id-ID")}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleManageSubscription(user)}
                              title="Kelola Subscription"
                            >
                              <Crown className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(user)}
                            >
                              <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Management Dialog */}
        <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Kelola Subscription</DialogTitle>
              <DialogDescription>
                {managingUser?.subscription 
                  ? `Perpanjang atau ubah subscription untuk ${managingUser?.full_name}`
                  : `Buat subscription baru untuk ${managingUser?.full_name}`
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {managingUser?.subscription && (
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm font-medium mb-2">Status Saat Ini:</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plan:</span>
                      <span className="font-medium">{managingUser.subscription.plan_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={managingUser.subscription.status === 'active' ? 'default' : 'secondary'}>
                        {managingUser.subscription.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires:</span>
                      <span className={
                        managingUser.subscription.expires_at && new Date(managingUser.subscription.expires_at) < new Date()
                          ? "text-destructive font-semibold"
                          : "font-medium"
                      }>
                        {managingUser.subscription.expires_at 
                          ? new Date(managingUser.subscription.expires_at).toLocaleDateString("id-ID")
                          : "-"
                        }
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Pilih Paket</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih paket" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - Rp {plan.price.toLocaleString("id-ID")} ({plan.duration_months} bulan)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Perpanjang Durasi (bulan)</Label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={extendMonths}
                  onChange={(e) => setExtendMonths(parseInt(e.target.value) || 1)}
                  placeholder="Jumlah bulan"
                />
                <p className="text-xs text-muted-foreground">
                  {managingUser?.subscription 
                    ? `Akan memperpanjang dari ${managingUser.subscription.expires_at ? new Date(managingUser.subscription.expires_at).toLocaleDateString("id-ID") : "sekarang"}`
                    : "Mulai dari hari ini"
                  }
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setSubscriptionDialogOpen(false)} 
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button onClick={handleSaveSubscription} className="flex-1">
                  {managingUser?.subscription ? "Perpanjang" : "Buat Subscription"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
