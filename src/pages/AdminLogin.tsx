import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { toast } from "sonner";

export const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true); // Add checking state

  useEffect(() => {
    // Check if already logged in as admin
    const checkAdmin = async () => {
      try {
        setChecking(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();

          if (data?.role === "admin") {
            navigate("/admin/dashboard");
            return;
          }
        }
      } catch (error) {
        console.error("Error checking admin session:", error);
      } finally {
        setChecking(false);
      }
    };
    checkAdmin();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

        if (error) {
          // 🔒 SECURITY: Log failed admin login attempt
          await supabase.from('auth_audit_logs' as any).insert({
            email,
            event_type: 'login_failed',
            login_method: 'admin_page',
            failure_reason: error.message,
            ip_address: null,
            user_agent: navigator.userAgent
          });

          toast.error("Email atau password salah");
          return;
        }

        // 🔒 SECURITY: Check if user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();

        if (roleData?.role !== "admin") {
          // 🔒 SECURITY: Log non-admin attempt to access admin page
          await supabase.from('auth_audit_logs' as any).insert({
            user_id: data.user.id,
            email,
            event_type: 'login_failed',
            login_method: 'admin_page',
            failure_reason: 'Non-admin user attempted admin login',
            ip_address: null,
            user_agent: navigator.userAgent
          });

          await supabase.auth.signOut();
          toast.error("Akses ditolak. Anda bukan admin.");
          return;
        }

        // 🔒 SECURITY: Log successful admin login
        await supabase.from('auth_audit_logs' as any).insert({
          user_id: data.user.id,
          email,
          event_type: 'login_success',
          login_method: 'admin_page',
          ip_address: null,
          user_agent: navigator.userAgent
        });

        toast.success("Login berhasil!");
        navigate("/admin/dashboard");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-16 pb-16 text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
              <Shield className="w-8 h-8 text-white animate-pulse" />
            </div>
            <div className="space-y-4">
              <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted-foreground text-sm">Memeriksa session admin...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Admin Portal</CardTitle>
            <CardDescription className="text-base mt-2">
              Login sebagai administrator
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Admin</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
            >
              {loading ? "Loading..." : "Login sebagai Admin"}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => navigate("/auth")}
                className="text-sm text-primary hover:underline"
              >
                Login sebagai User
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
