import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";

export const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        
        if (roleData?.role === "admin") {
          navigate("/admin/dashboard");
        } else {
          navigate("/dashboard");
        }
      }
    };
    
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setTimeout(async () => {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", session.user.id)
            .single();
          
          if (roleData?.role === "admin") {
            navigate("/admin/dashboard");
          } else {
            navigate("/dashboard");
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast.error("Email atau password salah");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Berhasil login!");
      } else {
        // Validasi nomor WhatsApp
        const cleanedNumber = whatsappNumber.replace(/\D/g, '');
        if (!cleanedNumber.startsWith('62')) {
          toast.error("Nomor WhatsApp harus diawali dengan 62 (format Indonesia)");
          return;
        }
        if (cleanedNumber.length < 10 || cleanedNumber.length > 15) {
          toast.error("Nomor WhatsApp tidak valid");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              whatsapp_number: cleanedNumber,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) {
          if (error.message.includes("already registered")) {
            toast.error("Email sudah terdaftar");
          } else {
            toast.error(error.message);
          }
          return;
        }

        toast.success("Akun berhasil dibuat! Silakan login.");
        setIsLogin(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">HalloWa</CardTitle>
            <CardDescription className="text-base mt-2">
              {isLogin ? "Masuk ke akun Anda" : "Buat akun baru"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Masukkan nama lengkap"
                    required={!isLogin}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    Nomor WhatsApp
                    <span className="text-xs font-normal text-destructive">*wajib</span>
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="628123456789"
                    required={!isLogin}
                  />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Format: 62xxx (tanpa +/spasi/tanda hubung)
                    </p>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-xs text-primary font-medium mb-1">
                        ✓ Manfaat untuk Anda:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
                        <li>Notifikasi penting tentang akun & layanan</li>
                        <li>Pengingat otomatis perpanjangan plan</li>
                        <li>Update fitur & promosi eksklusif</li>
                        <li>Dukungan customer service prioritas</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@example.com"
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
                minLength={6}
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground">
                  Minimal 6 karakter
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary text-white shadow-lg hover:shadow-xl transition-all"
              disabled={loading}
            >
              {loading ? "Loading..." : isLogin ? "Masuk" : "Daftar"}
            </Button>
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline block w-full"
              >
                {isLogin
                  ? "Belum punya akun? Daftar sekarang"
                  : "Sudah punya akun? Masuk"}
              </button>
              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate("/auth/reset-password")}
                  className="text-sm text-primary hover:underline block w-full"
                >
                  Lupa password?
                </button>
              )}
              {isLogin && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="text-sm text-muted-foreground hover:text-primary hover:underline block w-full"
                >
                  Login sebagai Admin
                </button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
