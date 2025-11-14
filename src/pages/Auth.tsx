import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  passwordSchema,
  calculatePasswordStrength,
  getPasswordStrengthLabel,
  PASSWORD_REQUIREMENTS
} from "@/utils/passwordValidation";
import { sanitizeText } from "@/utils/inputValidation";

export const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

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

  // 🔒 SECURITY: Validate password strength on change (for signup)
  useEffect(() => {
    if (!isLogin && password) {
      const strength = calculatePasswordStrength(password);
      setPasswordStrength(strength);

      // Validate with Zod schema
      const validation = passwordSchema.safeParse(password);
      if (!validation.success) {
        const errors = validation.error.errors.map(err => err.message);
        setPasswordErrors(errors);
      } else {
        setPasswordErrors([]);
      }
    } else {
      setPasswordErrors([]);
    }
  }, [password, isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          // 🔒 SECURITY: Log failed login attempt
          await supabase.from('auth_audit_logs' as any).insert({
            email,
            event_type: 'login_failed',
            login_method: 'user_page',
            failure_reason: error.message,
            ip_address: null, // Browser doesn't expose IP
            user_agent: navigator.userAgent
          });

          if (error.message.includes("Invalid login credentials")) {
            toast.error("Email atau password salah");
          } else {
            toast.error("Login gagal. Silakan coba lagi.");
          }
          return;
        }

        // 🔒 SECURITY: Check if user is admin - REJECT admin login from user page
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id)
          .single();
        
        if (roleData?.role === "admin") {
          // 🔒 SECURITY: Log admin rejection
          await supabase.from('auth_audit_logs' as any).insert({
            user_id: data.user.id,
            email,
            event_type: 'login_failed',
            login_method: 'user_page',
            failure_reason: 'Admin attempted login from user page',
            ip_address: null,
            user_agent: navigator.userAgent
          });

          await supabase.auth.signOut();
          toast.error("⚠️ Admin harus login melalui halaman admin", {
            duration: 5000,
            action: {
              label: "Ke Halaman Admin",
              onClick: () => navigate("/admin/login"),
            },
          });
          return;
        }

        // 🔒 SECURITY: Log successful login
        await supabase.from('auth_audit_logs' as any).insert({
          user_id: data.user.id,
          email,
          event_type: 'login_success',
          login_method: 'user_page',
          ip_address: null,
          user_agent: navigator.userAgent
        });

        toast.success("Berhasil login!");
      } else {
        // 🔒 SECURITY: Validate password strength for signup
        const passwordValidation = passwordSchema.safeParse(password);
        if (!passwordValidation.success) {
          toast.error("Password tidak memenuhi syarat keamanan");
          return;
        }

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

        // 🔒 SECURITY: Sanitize user inputs before storing
        const sanitizedFullName = sanitizeText(fullName);

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: sanitizedFullName,
              whatsapp_number: cleanedNumber,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (error) {
          // 🔒 SECURITY: Log failed signup
          await supabase.from('auth_audit_logs' as any).insert({
            email,
            event_type: 'signup_failed',
            login_method: 'user_page',
            failure_reason: error.message,
            ip_address: null,
            user_agent: navigator.userAgent
          });

          if (error.message.includes("already registered")) {
            toast.error("Email sudah terdaftar");
          } else {
            toast.error("Pendaftaran gagal. Silakan coba lagi.");
          }
          return;
        }

        // 🔒 SECURITY: Log successful signup
        if (data.user) {
          await supabase.from('auth_audit_logs' as any).insert({
            user_id: data.user.id,
            email,
            event_type: 'signup_success',
            login_method: 'user_page',
            ip_address: null,
            user_agent: navigator.userAgent
          });
        }

        toast.success("Akun berhasil dibuat! Silakan login.");
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error("Terjadi kesalahan. Silakan coba lagi.");
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
                minLength={isLogin ? 6 : 12}
              />
              {!isLogin && password && (
                <div className="space-y-2 mt-2">
                  {/* Password Strength Indicator */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Kekuatan Password</span>
                      <span className={getPasswordStrengthLabel(passwordStrength).color}>
                        {getPasswordStrengthLabel(passwordStrength).label}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${getPasswordStrengthLabel(passwordStrength).bgColor}`}
                        style={{ width: `${passwordStrength}%` }}
                      />
                    </div>
                  </div>

                  {/* Password Requirements Checklist */}
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Syarat Password:
                    </p>
                    {PASSWORD_REQUIREMENTS.map((req, index) => {
                      const isMet = passwordErrors.length === 0 ||
                        !passwordErrors.some(err => err.toLowerCase().includes(req.split(' ')[0].toLowerCase()));
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          {isMet ? (
                            <CheckCircle2 className="w-3 h-3 text-green-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-gray-400" />
                          )}
                          <span className={isMet ? "text-green-600" : "text-muted-foreground"}>
                            {req}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {!isLogin && !password && (
                <p className="text-xs text-muted-foreground">
                  Minimal 12 karakter dengan kombinasi huruf besar, huruf kecil, angka, dan simbol
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
