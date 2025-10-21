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
import { Shield, User, Mail, Calendar, Plus, Edit, Trash2 } from "lucide-react";
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
    plan_name: string;
    status: string;
    expires_at: string | null;
  } | null;
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

  useEffect(() => {
    fetchUsers();
  }, []);

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
          user_id,
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
                      <TableHead className="hidden lg:table-cell">Subscription</TableHead>
                      <TableHead className="hidden lg:table-cell">Status</TableHead>
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
                        <TableCell className="hidden lg:table-cell">
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
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
