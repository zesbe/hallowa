import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Send, XCircle, Clock, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface BroadcastStatsProps {
  broadcasts: Array<{
    sent_count: number;
    failed_count: number;
    status: string;
    target_contacts?: any;
  }>;
}

export function BroadcastStats({ broadcasts }: BroadcastStatsProps) {
  const totalSent = broadcasts.reduce((sum, b) => sum + (b.sent_count || 0), 0);
  const totalFailed = broadcasts.reduce((sum, b) => sum + (b.failed_count || 0), 0);
  const totalContacts = broadcasts.reduce((sum, b) => {
    const contacts = Array.isArray(b.target_contacts) ? b.target_contacts.length : 0;
    return sum + contacts;
  }, 0);
  const processing = broadcasts.filter(b => b.status === 'processing').length;
  const completed = broadcasts.filter(b => b.status === 'completed').length;

  const successRate = totalSent + totalFailed > 0 
    ? Math.round((totalSent / (totalSent + totalFailed)) * 100)
    : 0;

  const stats = [
    {
      title: "Terkirim",
      value: totalSent.toLocaleString(),
      icon: Send,
      color: "text-success",
      bgColor: "bg-success/10",
    },
    {
      title: "Gagal",
      value: totalFailed.toLocaleString(),
      icon: XCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
    {
      title: "Proses",
      value: processing.toString(),
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Selesai",
      value: completed.toString(),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-muted-foreground font-medium">{stat.title}</p>
                  <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
                    <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalSent + totalFailed > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tingkat keberhasilan</span>
              <span className="font-bold text-primary">{successRate}%</span>
            </div>
            <Progress value={successRate} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {totalSent} berhasil dari {totalSent + totalFailed} total pengiriman
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
