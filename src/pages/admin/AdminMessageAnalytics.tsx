import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface MessageData {
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  successRate: number;
  totalBroadcasts: number;
  activeBroadcasts: number;
  messagesByType: { type: string; count: number }[];
  broadcastPerformance: Array<{
    name: string;
    sent: number;
    failed: number;
    status: string;
  }>;
  messagesByDay: { day: string; count: number }[];
}

export const AdminMessageAnalytics = () => {
  const [data, setData] = useState<MessageData>({
    totalMessages: 0,
    successfulMessages: 0,
    failedMessages: 0,
    successRate: 0,
    totalBroadcasts: 0,
    activeBroadcasts: 0,
    messagesByType: [],
    broadcastPerformance: [],
    messagesByDay: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessageData();
  }, []);

  const fetchMessageData = async () => {
    try {
      // Total messages
      const { count: totalMessages } = await supabase
        .from("message_history")
        .select("*", { count: "exact", head: true });

      // Messages by type
      const { data: messages } = await supabase
        .from("message_history")
        .select("message_type");

      const typeCounts = messages?.reduce((acc: any, msg) => {
        acc[msg.message_type] = (acc[msg.message_type] || 0) + 1;
        return acc;
      }, {});

      const messagesByType = Object.entries(typeCounts || {}).map(([type, count]) => ({
        type,
        count: count as number
      }));

      // Queue statistics
      const { data: queueMessages } = await supabase
        .from("message_queue")
        .select("status");

      const successfulMessages = queueMessages?.filter(m => m.status === "sent").length || 0;
      const failedMessages = queueMessages?.filter(m => m.status === "failed").length || 0;
      const successRate = queueMessages && queueMessages.length > 0
        ? (successfulMessages / queueMessages.length) * 100
        : 0;

      // Broadcasts
      const { count: totalBroadcasts } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true });

      const { count: activeBroadcasts } = await supabase
        .from("broadcasts")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "sending"]);

      // Broadcast performance
      const { data: broadcasts } = await supabase
        .from("broadcasts")
        .select("name, sent_count, failed_count, status")
        .order("created_at", { ascending: false })
        .limit(10);

      const broadcastPerformance = broadcasts?.map(b => ({
        name: b.name,
        sent: b.sent_count || 0,
        failed: b.failed_count || 0,
        status: b.status
      })) || [];

      // Messages by day (last 7 days)
      const { data: recentMessages } = await supabase
        .from("message_history")
        .select("created_at")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const dayCounts = recentMessages?.reduce((acc: any, msg) => {
        const day = new Date(msg.created_at).toLocaleDateString("id-ID", { weekday: "short" });
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      const messagesByDay = Object.entries(dayCounts || {}).map(([day, count]) => ({
        day,
        count: count as number
      }));

      setData({
        totalMessages: totalMessages || 0,
        successfulMessages,
        failedMessages,
        successRate,
        totalBroadcasts: totalBroadcasts || 0,
        activeBroadcasts: activeBroadcasts || 0,
        messagesByType,
        broadcastPerformance,
        messagesByDay
      });
    } catch (error) {
      console.error("Error fetching message data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <p className="text-muted-foreground">Loading message analytics...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-8 h-8 text-primary" />
            Message Analytics
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Track message delivery and broadcast performance
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Total Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {data.successRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.successfulMessages} successful
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                Failed Messages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {data.failedMessages}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Send className="w-4 h-4" />
                Broadcasts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.totalBroadcasts}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.activeBroadcasts} active
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Messages by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Messages by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.messagesByType.map((item) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{item.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {item.count.toLocaleString()}
                    </span>
                    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(item.count / data.totalMessages) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Messages by Day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Messages (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.messagesByDay.map((item) => (
                <div key={item.day} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.day}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {item.count.toLocaleString()}
                    </span>
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(item.count / Math.max(...data.messagesByDay.map(d => d.count))) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Broadcast Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Broadcast Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.broadcastPerformance.map((broadcast, index) => (
                <div key={index} className="border-b pb-3 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{broadcast.name}</p>
                    <Badge variant={
                      broadcast.status === "completed" ? "default" :
                      broadcast.status === "sending" ? "secondary" :
                      "outline"
                    }>
                      {broadcast.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-muted-foreground">
                        {broadcast.sent} sent
                      </span>
                    </div>
                    {broadcast.failed > 0 && (
                      <div className="flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-destructive" />
                        <span className="text-muted-foreground">
                          {broadcast.failed} failed
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMessageAnalytics;
