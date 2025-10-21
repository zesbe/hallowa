import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shield, User, Mail, Calendar } from "lucide-react";
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

export const AdminUsers = () => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, created_at");

      if (!profiles) return;

      const usersData: UserData[] = [];
      
      for (const profile of profiles) {
        const { data: authData } = await supabase.auth.admin.getUserById(profile.id);
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", profile.id)
          .single();

        // Fetch subscription data
        const { data: subscriptionData } = await supabase
          .from("user_subscriptions")
          .select(`
            status,
            expires_at,
            plan_id,
            plans (
              name
            )
          `)
          .eq("user_id", profile.id)
          .single();

        if (authData.user) {
          usersData.push({
            id: profile.id,
            full_name: profile.full_name,
            email: authData.user.email || "",
            role: roleData?.role || "user",
            created_at: profile.created_at,
            subscription: subscriptionData ? {
              plan_name: (subscriptionData.plans as any)?.name || "No Plan",
              status: subscriptionData.status,
              expires_at: subscriptionData.expires_at,
            } : null,
          });
        }
      }

      setUsers(usersData);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Gagal memuat data users");
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === "admin" ? "user" : "admin";
      
      await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);

      toast.success(`Role berhasil diubah menjadi ${newRole}`);
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Gagal mengubah role");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Kelola User</h1>
          <p className="text-muted-foreground mt-2">
            Manage users dan permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Daftar User</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading...</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Subscription</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Terdaftar</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              user.role === "admin" ? "bg-orange-500" : "bg-blue-500"
                            }`}>
                              {user.role === "admin" ? (
                                <Shield className="w-4 h-4 text-white" />
                              ) : (
                                <User className="w-4 h-4 text-white" />
                              )}
                            </div>
                            <span className="font-medium">{user.full_name || "No Name"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => toggleRole(user.id, user.role)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {new Date(user.created_at).toLocaleDateString("id-ID")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleRole(user.id, user.role)}
                          >
                            {user.role === "admin" ? "Set User" : "Set Admin"}
                          </Button>
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
