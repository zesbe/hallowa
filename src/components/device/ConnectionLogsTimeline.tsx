/**
 * Connection Logs Timeline Component
 * ====================================
 * Displays chronological timeline of device connection events with filtering
 *
 * Features:
 * - Chronological event timeline with icons
 * - Event type filtering (all, connected, disconnected, errors)
 * - Pagination for large log sets
 * - Duration display for disconnections
 * - Error details expansion
 * - Real-time updates support
 * - Responsive design
 *
 * Security:
 * - Data fetched via authenticated Supabase query
 * - RLS policies ensure users only see own logs
 * - Error messages sanitized on backend
 * - Pagination enforced (max 50 per page)
 * - Input validation for filters
 *
 * @module ConnectionLogsTimeline
 */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  QrCode,
  Smartphone,
  LogOut,
  RefreshCw,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ConnectionLog {
  id: string;
  device_id: string;
  event_type: string;
  timestamp: string;
  details: Record<string, any>;
  error_code: string | null;
  error_message: string | null;
  connection_duration_seconds: number | null;
}

interface ConnectionLogsTimelineProps {
  deviceId: string;
  maxHeight?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  pageSize?: number;
}

export const ConnectionLogsTimeline: React.FC<ConnectionLogsTimelineProps> = ({
  deviceId,
  maxHeight = "500px",
  autoRefresh = false,
  refreshInterval = 60000,
  pageSize = 50
}) => {
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Fetch connection logs
  const fetchLogs = async (currentPage: number = 0, eventFilter: string = "all") => {
    try {
      setLoading(true);
      setError(null);

      // 🔒 SECURITY: Enforce page size limit (max 50)
      const safePageSize = Math.min(Math.max(pageSize, 1), 50);
      const offset = currentPage * safePageSize;

      let query = supabase
        .from('device_connection_logs')
        .select('*')
        .eq('device_id', deviceId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + safePageSize);

      // 🔒 SECURITY: Validate filter value
      if (eventFilter !== "all") {
        const validFilters = ['connected', 'disconnected', 'error', 'logout', 'qr_generated', 'pairing_code_generated'];
        if (validFilters.includes(eventFilter)) {
          query = query.eq('event_type', eventFilter);
        }
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error('Failed to fetch logs:', queryError);
        setError('Gagal memuat riwayat koneksi');
        return;
      }

      setLogs(data || []);
      setHasMore(data && data.length === safePageSize);

    } catch (err: any) {
      console.error('Exception fetching logs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchLogs(page, filter);

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchLogs(page, filter);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [deviceId, page, filter, autoRefresh, refreshInterval]);

  // Event icon and color mapping
  const getEventStyle = (eventType: string) => {
    switch (eventType) {
      case 'connected':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'bg-green-500',
          textColor: 'text-green-700',
          bgColor: 'bg-green-50 dark:bg-green-950/30',
          borderColor: 'border-green-200 dark:border-green-800',
          label: 'Connected'
        };
      case 'disconnected':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'bg-red-500',
          textColor: 'text-red-700',
          bgColor: 'bg-red-50 dark:bg-red-950/30',
          borderColor: 'border-red-200 dark:border-red-800',
          label: 'Disconnected'
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          color: 'bg-red-600',
          textColor: 'text-red-800',
          bgColor: 'bg-red-100 dark:bg-red-950/50',
          borderColor: 'border-red-300 dark:border-red-700',
          label: 'Error'
        };
      case 'logout':
        return {
          icon: <LogOut className="w-4 h-4" />,
          color: 'bg-orange-500',
          textColor: 'text-orange-700',
          bgColor: 'bg-orange-50 dark:bg-orange-950/30',
          borderColor: 'border-orange-200 dark:border-orange-800',
          label: 'Logout'
        };
      case 'qr_generated':
        return {
          icon: <QrCode className="w-4 h-4" />,
          color: 'bg-blue-500',
          textColor: 'text-blue-700',
          bgColor: 'bg-blue-50 dark:bg-blue-950/30',
          borderColor: 'border-blue-200 dark:border-blue-800',
          label: 'QR Generated'
        };
      case 'pairing_code_generated':
        return {
          icon: <Smartphone className="w-4 h-4" />,
          color: 'bg-purple-500',
          textColor: 'text-purple-700',
          bgColor: 'bg-purple-50 dark:bg-purple-950/30',
          borderColor: 'border-purple-200 dark:border-purple-800',
          label: 'Pairing Code'
        };
      case 'reconnect_attempt':
        return {
          icon: <RefreshCw className="w-4 h-4" />,
          color: 'bg-yellow-500',
          textColor: 'text-yellow-700',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          label: 'Reconnect'
        };
      default:
        return {
          icon: <Info className="w-4 h-4" />,
          color: 'bg-gray-500',
          textColor: 'text-gray-700',
          bgColor: 'bg-gray-50 dark:bg-gray-950/30',
          borderColor: 'border-gray-200 dark:border-gray-800',
          label: eventType
        };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;

    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Loading state
  if (loading && logs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
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
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Connection History
          </CardTitle>

          {/* Event Filter */}
          <Select value={filter} onValueChange={(val) => { setFilter(val); setPage(0); }}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="disconnected">Disconnected</SelectItem>
              <SelectItem value="error">Errors</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Belum ada riwayat koneksi</p>
          </div>
        ) : (
          <>
            <ScrollArea style={{ height: maxHeight }} className="px-4">
              <div className="space-y-0 py-2">
                {logs.map((log, index) => {
                  const eventStyle = getEventStyle(log.event_type);
                  const isExpanded = expandedLog === log.id;
                  const duration = formatDuration(log.connection_duration_seconds);

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "relative flex gap-3 pb-4",
                        index !== logs.length - 1 && "border-l-2 border-muted ml-2"
                      )}
                    >
                      {/* Timeline dot */}
                      <div
                        className={cn(
                          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          eventStyle.color,
                          "text-white -ml-4"
                        )}
                      >
                        {eventStyle.icon}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div
                          className={cn(
                            "rounded-lg border p-3 transition-colors cursor-pointer",
                            eventStyle.borderColor,
                            eventStyle.bgColor,
                            isExpanded && "ring-2 ring-primary"
                          )}
                          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-sm font-medium", eventStyle.textColor)}>
                                {eventStyle.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatTimestamp(log.timestamp)}
                              </p>
                            </div>

                            {duration && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {duration}
                              </Badge>
                            )}
                          </div>

                          {/* Error details (always show if present) */}
                          {log.error_message && (
                            <div className="mt-2 p-2 bg-red-100 dark:bg-red-950/50 rounded border border-red-200 dark:border-red-800">
                              <p className="text-xs text-red-800 dark:text-red-200 break-words">
                                {log.error_message}
                              </p>
                              {log.error_code && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  Code: {log.error_code}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Expanded details */}
                          {isExpanded && log.details && Object.keys(log.details).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-current/10">
                              <p className="text-xs font-medium mb-1">Details:</p>
                              <div className="space-y-1">
                                {Object.entries(log.details).map(([key, value]) => (
                                  <div key={key} className="flex items-start gap-2 text-xs">
                                    <span className="text-muted-foreground capitalize min-w-[80px]">
                                      {key.replace(/_/g, ' ')}:
                                    </span>
                                    <span className="break-all">
                                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Pagination */}
            {(page > 0 || hasMore) && (
              <div className="flex items-center justify-between p-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <span className="text-xs text-muted-foreground">
                  Page {page + 1}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore || loading}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ConnectionLogsTimeline;
