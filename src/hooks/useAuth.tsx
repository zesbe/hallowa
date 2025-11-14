import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

export type UserRole = "admin" | "user";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .single();

      if (error) {
        console.error("Error fetching role:", error);
        setRole("user"); // Default to user role
      } else {
        setRole(data?.role as UserRole);
      }
    } catch (error) {
      console.error("Error:", error);
      setRole("user");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    // 🔒 SECURITY: Log logout
    if (user) {
      await supabase.from('auth_audit_logs' as any).insert({
        user_id: user.id,
        email: user.email || '',
        event_type: 'logout',
        login_method: role === 'admin' ? 'admin_page' : 'user_page',
        ip_address: null,
        user_agent: navigator.userAgent
      });
    }

    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    // Force reload to ensure clean state
    window.location.href = "/auth";
  };

  return { user, role, loading, signOut };
};
