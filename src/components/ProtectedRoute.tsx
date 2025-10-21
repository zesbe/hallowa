import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, UserRole } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Not logged in
        if (requiredRole === "admin") {
          navigate("/admin/login");
        } else {
          navigate("/auth");
        }
      } else if (requiredRole && role !== requiredRole) {
        // Logged in but wrong role
        if (requiredRole === "admin") {
          navigate("/dashboard");
        } else {
          navigate("/admin/dashboard");
        }
      }
    }
  }, [user, role, loading, requiredRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || (requiredRole && role !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
};
