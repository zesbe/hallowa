import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, CheckCircle, XCircle, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface AuthLog {
  id: string;
  user_id: string | null;
  email: string;
  event_type: string;
  login_method: string | null;
  ip_address: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: string;
}

export default function AdminAuthLogs() {
  const [logs, setLogs] = useState<AuthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchEmail, setSearchEmail] = useState("");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterMethod, setFilterMethod] = useState<string>("all");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('auth_audit_logs' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data, error } = await query;

      if (error) throw error;
      setLogs((data as any) || []);
    } catch (error) {
      console.error('Error fetching auth logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventBadge = (eventType: string) => {
    const badges: Record<string, { variant: "default" | "destructive" | "outline" | "secondary", icon: any, label: string }> = {
      'login_success': { variant: 'default', icon: CheckCircle, label: 'Login Sukses' },
      'login_failed': { variant: 'destructive', icon: XCircle, label: 'Login Gagal' },
      'logout': { variant: 'secondary', icon: Shield, label: 'Logout' },
      'signup_success': { variant: 'default', icon: CheckCircle, label: 'Daftar Sukses' },
      'signup_failed': { variant: 'destructive', icon: AlertTriangle, label: 'Daftar Gagal' },
    };

    const config = badges[eventType] || { variant: 'outline', icon: Shield, label: eventType };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const getMethodBadge = (method: string | null) => {
    if (!method) return <Badge variant="outline">Unknown</Badge>;
    
    const colors: Record<string, string> = {
      'admin_page': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'user_page': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'api': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };

    return (
      <Badge variant="outline" className={colors[method]}>
        {method === 'admin_page' ? '👑 Admin' : method === 'user_page' ? '👤 User' : '🔌 API'}
      </Badge>
    );
  };

  const filteredLogs = logs.filter(log => {
    const matchesEmail = log.email.toLowerCase().includes(searchEmail.toLowerCase());
    const matchesEvent = filterEvent === 'all' || log.event_type === filterEvent;
    const matchesMethod = filterMethod === 'all' || log.login_method === filterMethod;
    return matchesEmail && matchesEvent && matchesMethod;
  });

  const stats = {
    total: logs.length,
    success: logs.filter(l => l.event_type.includes('success')).length,
    failed: logs.filter(l => l.event_type.includes('failed')).length,
    admin: logs.filter(l => l.login_method === 'admin_page').length,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8" />
            Authentication Logs
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor semua login attempts dan activity untuk keamanan sistem
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Logs</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Login Sukses</CardDescription>
              <CardTitle className="text-3xl text-green-600">{stats.success}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Login Gagal</CardDescription>
              <CardTitle className="text-3xl text-red-600">{stats.failed}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Admin Activity</CardDescription>
              <CardTitle className="text-3xl text-orange-600">{stats.admin}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan email..."
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterEvent} onValueChange={setFilterEvent}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Event Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Events</SelectItem>
                <SelectItem value="login_success">Login Sukses</SelectItem>
                <SelectItem value="login_failed">Login Gagal</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="signup_success">Signup Sukses</SelectItem>
                <SelectItem value="signup_failed">Signup Gagal</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterMethod} onValueChange={setFilterMethod}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Login Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Methods</SelectItem>
                <SelectItem value="admin_page">Admin Page</SelectItem>
                <SelectItem value="user_page">User Page</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity ({filteredLogs.length})</CardTitle>
            <CardDescription>
              Menampilkan {filteredLogs.length} dari {logs.length} logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>User Agent</TableHead>
                      <TableHead>Failure Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(log.created_at), 'dd MMM yyyy HH:mm', { locale: localeId })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.email}</TableCell>
                        <TableCell>{getEventBadge(log.event_type)}</TableCell>
                        <TableCell>{getMethodBadge(log.login_method)}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {log.user_agent || '-'}
                        </TableCell>
                        <TableCell className="max-w-xs text-sm">
                          {log.failure_reason ? (
                            <span className="text-red-600 dark:text-red-400">{log.failure_reason}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
