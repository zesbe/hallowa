import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, User, Bell, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Clear all local storage
      localStorage.clear();
      sessionStorage.clear();
      toast.success("Berhasil logout");
      // Force reload to ensure clean state
      window.location.href = "/auth";
    } catch (error) {
      toast.error("Gagal logout");
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Settings</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Kelola pengaturan akun dan aplikasi
          </p>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-5 h-5" />
                Profile
              </CardTitle>
              <CardDescription>
                Informasi akun Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="w-5 h-5" />
                Notifications
              </CardTitle>
              <CardDescription>
                Kelola notifikasi aplikasi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Coming soon...
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Security
              </CardTitle>
              <CardDescription>
                Keamanan dan privasi
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="w-full"
              >
                Logout
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
