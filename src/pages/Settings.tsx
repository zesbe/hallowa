import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Bell, Shield, Key, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

interface ProfileData {
  full_name: string;
  phone_number: string;
  email: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    full_name: "",
    phone_number: "",
    email: "",
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, email")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile({
          full_name: data.full_name || "",
          phone_number: data.phone_number || "",
          email: data.email || user?.email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Gagal memuat profil");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name,
          phone_number: profile.phone_number,
        })
        .eq("id", user?.id);

      if (error) throw error;

      toast.success("Profil berhasil diperbarui");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Gagal memperbarui profil");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      
      // 🔒 SECURITY: Clear only app-specific storage
      const keysToRemove = [
        'wapanels-theme',
        'sidebar-scroll-position',
        'quick-message'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      toast.success("Berhasil logout");
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
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Nama Lengkap</Label>
                    <Input
                      id="full_name"
                      type="text"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      placeholder="Masukkan nama lengkap"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email tidak dapat diubah
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Nomor Telepon</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={profile.phone_number}
                      onChange={(e) =>
                        setProfile({ ...profile, phone_number: e.target.value })
                      }
                      placeholder="Contoh: 628123456789"
                    />
                  </div>

                  <Button type="submit" disabled={saving} className="w-full">
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan Perubahan"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Key className="w-5 h-5" />
                API Management
              </CardTitle>
              <CardDescription>
                Kelola API keys untuk integrasi dengan aplikasi lain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  API Keys Akun
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate API keys untuk mengakses API WAPANELS dari aplikasi eksternal
                </p>
                <Link to="/api-keys">
                  <Button variant="outline" size="sm" className="w-full">
                    <Key className="w-4 h-4 mr-2" />
                    Kelola API Keys
                  </Button>
                </Link>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Webhook className="w-4 h-4" />
                  Webhook Integrasi
                </h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Atur webhook untuk menerima notifikasi real-time dari WhatsApp
                </p>
                <Link to="/webhooks">
                  <Button variant="outline" size="sm" className="w-full">
                    <Webhook className="w-4 h-4 mr-2" />
                    Kelola Webhooks
                  </Button>
                </Link>
              </div>

              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  💡 <strong>Tips:</strong> Gunakan API keys untuk integrasi dengan sistem CRM, e-commerce, atau aplikasi custom Anda.
                </p>
              </div>
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
