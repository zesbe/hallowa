import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  full_name: string;
  role?: "user" | "admin";
}

interface UpdateUserRequest {
  user_id: string;
  full_name?: string;
  email?: string;
  role?: "user" | "admin";
}

interface DeleteUserRequest {
  user_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      throw new Error("Forbidden: Admin access required");
    }

    const { action, ...payload } = await req.json();

    switch (action) {
      case "create": {
        const { email, password, full_name, role = "user" } = payload as CreateUserRequest;

        // Validate inputs
        if (!email || !password || !full_name) {
          throw new Error("Missing required fields: email, password, full_name");
        }

        // Strong password validation
        if (password.length < 12) {
          throw new Error("Password must be at least 12 characters long");
        }

        if (!/[a-z]/.test(password)) {
          throw new Error("Password must contain at least one lowercase letter");
        }

        if (!/[A-Z]/.test(password)) {
          throw new Error("Password must contain at least one uppercase letter");
        }

        if (!/[0-9]/.test(password)) {
          throw new Error("Password must contain at least one number");
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
          throw new Error("Password must contain at least one special character");
        }

        // Check against common weak passwords
        const weakPasswords = [
          'password123', 'password1234', '12345678', '123456789',
          'qwerty123', 'qwerty1234', 'admin123', 'admin1234'
        ];
        if (weakPasswords.includes(password.toLowerCase())) {
          throw new Error("Password is too common. Please choose a stronger password");
        }

        // Create user in auth
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name },
        });

        if (createError) throw createError;

        // Profile will be created by trigger, but we'll set the role
        const { error: roleInsertError } = await supabase
          .from("user_roles")
          .upsert({ user_id: newUser.user.id, role });

        if (roleInsertError) throw roleInsertError;

        return new Response(
          JSON.stringify({ success: true, user: newUser.user }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        const { user_id, full_name, email, role } = payload as UpdateUserRequest;

        if (!user_id) {
          throw new Error("Missing required field: user_id");
        }

        // Update auth email if provided
        if (email) {
          const { error: emailError } = await supabase.auth.admin.updateUserById(
            user_id,
            { email }
          );
          if (emailError) throw emailError;
        }

        // Update profile if full_name provided
        if (full_name) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({ full_name })
            .eq("id", user_id);

          if (profileError) throw profileError;
        }

        // Update role if provided
        if (role) {
          const { error: roleError } = await supabase
            .from("user_roles")
            .update({ role })
            .eq("user_id", user_id);

          if (roleError) throw roleError;
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        const { user_id } = payload as DeleteUserRequest;

        if (!user_id) {
          throw new Error("Missing required field: user_id");
        }

        // Delete user from auth (cascades to profiles and user_roles)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);

        if (deleteError) throw deleteError;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error("Invalid action. Must be 'create', 'update', or 'delete'");
    }
  } catch (error) {
    console.error("Error in admin-user-management:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});