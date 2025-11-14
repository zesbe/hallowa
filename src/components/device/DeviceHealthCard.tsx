/**
 * Device Health Card Component
 * =============================
 * Displays real-time health metrics and status for WhatsApp devices
 *
 * Features:
 * - Health status indicator (healthy, warning, critical, offline)
 * - Uptime tracking
 * - Message statistics (sent, failed, error rate)
 * - Performance metrics
 * - Issue detection and alerts
 *
 * Security:
 * - Data fetched via authenticated Supabase RPC
 * - RLS policies ensure users only see own device health
 * - Error messages sanitized
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Clock,
  Send,
  AlertTriangle,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DeviceHealthMetrics {
  health_status: 'healthy' | 'warning' | 'critical' | 'offline';
  uptime_minutes: number;
  messages_sent_today: number;
  error_rate_percent: number;
  last_error_message: string | null;
  reconnect_count_today: number;
}

interface DeviceHealthCardProps {
  deviceId: string;
  deviceName: string;
  deviceStatus: string;
  refreshInterval?: number; // milliseconds
  compact?: boolean;
}

export const DeviceHealthCard: React.FC<DeviceHealthCardProps> = ({
  deviceId,
  deviceName,
  deviceStatus,
  refreshInterval = 30000, // 30 seconds
  compact = false
}) => {
  const [health, setHealth] = useState<DeviceHealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch health metrics
  const fetchHealthMetrics = async () => {
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_device_health_summary' as any, {
          p_device_id: deviceId
        });

      if (rpcError) {
        console.error('Failed to fetch health metrics:', rpcError);
        setError('Gagal memuat health data');
        return;
      }

      if (data && Array.isArray(data) && data.length > 0) {
        setHealth(data[0]);
        setError(null);
      } else {
        // No health data yet - device might be new
        setHealth({
          health_status: deviceStatus === 'connected' ? 'healthy' : 'offline',
          uptime_minutes: 0,
          messages_sent_today: 0,
          error_rate_percent: 0,
          last_error_message: null,
          reconnect_count_today: 0
        });
      }
    } catch (err: any) {
      console.error('Exception fetching health:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchHealthMetrics();

    const interval = setInterval(fetchHealthMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [deviceId, refreshInterval]);

  // Get health status color and icon
  const getHealthIndicator = (status: string) => {
    switch (status) {
      case 'healthy':
        return {
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50 dark:bg-green-950',
          borderColor: 'border-green-200 dark:border-green-800',
          icon: <CheckCircle2 className="w-4 h-4" />,
          label: 'Healthy'
        };
      case 'warning':
        return {
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          icon: <AlertTriangle className="w-4 h-4" />,
          label: 'Warning'
        };
      case 'critical':
        return {
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50 dark:bg-red-950',
          borderColor: 'border-red-200 dark:border-red-800',
          icon: <XCircle className="w-4 h-4" />,
          label: 'Critical'
        };
      default:
        return {
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50 dark:bg-gray-950',
          borderColor: 'border-gray-200 dark:border-gray-800',
          icon: <AlertCircle className="w-4 h-4" />,
          label: 'Offline'
        };
    }
  };

  // Format uptime
  const formatUptime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
      return `${hours}h ${mins}m`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="w-4 h-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!health) {
    return null;
  }

  const healthIndicator = getHealthIndicator(health.health_status);

  // Compact view
  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-2 p-2 rounded-lg border",
        healthIndicator.borderColor,
        healthIndicator.bgColor
      )}>
        <div className={cn("w-2 h-2 rounded-full", healthIndicator.color)} />
        <span className={cn("text-xs font-medium", healthIndicator.textColor)}>
          {healthIndicator.label}
        </span>
        {health.error_rate_percent > 0 && (
          <span className="text-xs text-muted-foreground">
            {health.error_rate_percent.toFixed(1)}% errors
          </span>
        )}
      </div>
    );
  }

  // Full view
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Device Health
          </CardTitle>
          <Badge className={cn("flex items-center gap-1", healthIndicator.color, "text-white")}>
            {healthIndicator.icon}
            {healthIndicator.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Uptime */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>Uptime</span>
              </div>
              <p className="text-lg font-bold">
                {formatUptime(health.uptime_minutes)}
              </p>
            </div>

            {/* Messages Sent */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Send className="w-3 h-3" />
                <span>Messages Today</span>
              </div>
              <p className="text-lg font-bold">{health.messages_sent_today}</p>
            </div>

            {/* Error Rate */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="w-3 h-3" />
                <span>Error Rate</span>
              </div>
              <p className={cn(
                "text-lg font-bold",
                health.error_rate_percent > 10 ? "text-red-500" :
                health.error_rate_percent > 5 ? "text-yellow-500" :
                "text-green-500"
              )}>
                {health.error_rate_percent.toFixed(1)}%
              </p>
            </div>

            {/* Reconnects */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Reconnects</span>
              </div>
              <p className="text-lg font-bold">{health.reconnect_count_today}</p>
            </div>
          </div>

          {/* Error Rate Progress Bar */}
          {health.error_rate_percent > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Error Rate</span>
                <span className={cn(
                  health.error_rate_percent > 10 ? "text-red-500" :
                  health.error_rate_percent > 5 ? "text-yellow-500" :
                  "text-green-500"
                )}>
                  {health.error_rate_percent.toFixed(1)}%
                </span>
              </div>
              <Progress
                value={Math.min(health.error_rate_percent, 100)}
                className={cn(
                  "h-2",
                  health.error_rate_percent > 10 ? "[&>div]:bg-red-500" :
                  health.error_rate_percent > 5 ? "[&>div]:bg-yellow-500" :
                  "[&>div]:bg-green-500"
                )}
              />
            </div>
          )}

          {/* Issues Alert */}
          {(health.error_rate_percent > 10 || health.reconnect_count_today > 5 || health.last_error_message) && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="w-4 h-4" />
              <AlertTitle>Issues Detected</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4 space-y-1 text-xs mt-2">
                  {health.error_rate_percent > 10 && (
                    <li>High error rate: {health.error_rate_percent.toFixed(1)}% - Check device connection</li>
                  )}
                  {health.reconnect_count_today > 5 && (
                    <li>Multiple reconnects: {health.reconnect_count_today} today - Unstable connection</li>
                  )}
                  {health.last_error_message && (
                    <li className="break-words">Last error: {health.last_error_message.substring(0, 100)}</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Healthy Status */}
          {health.health_status === 'healthy' && health.uptime_minutes > 60 && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-xs text-green-700 dark:text-green-300">
                Device is operating normally with no issues detected
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceHealthCard;
