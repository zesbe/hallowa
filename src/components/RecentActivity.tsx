import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Smartphone, Send, MessageSquare, Users, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface ActivityItem {
  id: string;
  type: "device" | "broadcast" | "template" | "contact";
  action: string;
  timestamp: string;
  status?: "success" | "failed" | "pending";
  metadata?: any;
}

export const RecentActivity = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivities();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('recent-activities')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devices' }, fetchRecentActivities)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, fetchRecentActivities)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_templates' }, fetchRecentActivities)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const activities: ActivityItem[] = [];

      // Device activities
      const { data: deviceLogs } = await supabase
        .from("device_connection_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(5);

      deviceLogs?.forEach((log) => {
        const details = log.details as any;
        const deviceName = details?.device_name || "Unknown";
        activities.push({
          id: log.id,
          type: "device",
          action: log.event_type === "connected" 
            ? `Device '${deviceName}' connected`
            : `Device '${deviceName}' disconnected`,
          timestamp: log.timestamp,
          status: log.event_type === "connected" ? "success" : "failed",
          metadata: log.details
        });
      });

      // Broadcast activities
      const { data: broadcasts } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      broadcasts?.forEach((broadcast) => {
        const contactCount = Array.isArray(broadcast.target_contacts) 
          ? broadcast.target_contacts.length 
          : 0;
        activities.push({
          id: broadcast.id,
          type: "broadcast",
          action: `Broadcast sent to ${contactCount} contacts`,
          timestamp: broadcast.created_at,
          status: broadcast.status === "completed" ? "success" : broadcast.status === "failed" ? "failed" : "pending",
          metadata: { name: broadcast.name }
        });
      });

      // Template activities
      const { data: templates } = await supabase
        .from("message_templates")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      templates?.forEach((template) => {
        activities.push({
          id: template.id,
          type: "template",
          action: `New template '${template.name}' created`,
          timestamp: template.created_at,
          status: "success"
        });
      });

      // Contact activities
      const { data: contacts } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      contacts?.forEach((contact) => {
        activities.push({
          id: contact.id,
          type: "contact",
          action: `New contact '${contact.name || contact.phone_number}' added`,
          timestamp: contact.created_at,
          status: "success"
        });
      });

      // Sort by timestamp and limit to 10
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      setActivities(sortedActivities);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "device":
        return Smartphone;
      case "broadcast":
        return Send;
      case "template":
        return MessageSquare;
      case "contact":
        return Users;
      default:
        return Activity;
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "pending":
        return <Clock className="w-4 h-4 text-warning" />;
      default:
        return null;
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case "device":
        return "from-primary/20 to-primary/10";
      case "broadcast":
        return "from-secondary/20 to-secondary/10";
      case "template":
        return "from-accent/20 to-accent/10";
      case "contact":
        return "from-success/20 to-success/10";
      default:
        return "from-muted/20 to-muted/10";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border animate-pulse">
                <div className="w-10 h-10 bg-muted rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada aktivitas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((activity) => {
              const Icon = getIcon(activity.type);
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-accent/30 transition-colors group"
                >
                  <div className={`w-10 h-10 bg-gradient-to-br ${getStatusColor(activity.type)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-2">
                        {activity.action}
                      </p>
                      {getStatusIcon(activity.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(activity.timestamp), { 
                        addSuffix: true,
                        locale: id 
                      })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
