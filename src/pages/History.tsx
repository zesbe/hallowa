import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Search,
  Download,
  Filter,
  MessageSquare,
  Phone,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Image,
  Video,
  FileText,
  Music,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface MessageHistory {
  id: string;
  device_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  message_type: string;
  message_content: string | null;
  media_url: string | null;
  status: string;
  error_message: string | null;
  campaign_name: string | null;
  is_group: boolean;
  sent_at: string;
  devices?: {
    name: string;
    phone_number: string;
  };
}

interface Device {
  id: string;
  name: string;
  phone_number: string;
}

export default function History() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageHistory[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (user) {
      fetchDevices();
      fetchMessages();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, name, phone_number")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error("Error fetching devices:", error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("message_history")
        .select(`
          *,
          devices!inner(name, phone_number)
        `)
        .eq("user_id", user?.id)
        .order("sent_at", { ascending: false })
        .limit(100);

      // Apply filters
      if (selectedDevice !== "all") {
        query = query.eq("device_id", selectedDevice);
      }
      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }
      if (selectedType !== "all") {
        query = query.eq("message_type", selectedType);
      }
      if (dateFrom) {
        query = query.gte("sent_at", new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        query = query.lte("sent_at", new Date(dateTo).toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      toast.error("Gagal memuat riwayat pesan");
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user?.id) return;

    const channel = supabase
      .channel("message-history-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "message_history",
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchMessages(); // Refresh when new message added
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (user) {
      fetchMessages();
    }
  }, [selectedDevice, selectedStatus, selectedType, dateFrom, dateTo]);

  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      msg.recipient_phone.toLowerCase().includes(search) ||
      msg.recipient_name?.toLowerCase().includes(search) ||
      msg.message_content?.toLowerCase().includes(search) ||
      msg.campaign_name?.toLowerCase().includes(search)
    );
  });

  const handleExport = () => {
    try {
      const csvContent = [
        ["Tanggal", "Device", "Penerima", "Nama", "Tipe", "Pesan", "Status", "Campaign"].join(","),
        ...filteredMessages.map((msg) =>
          [
            format(new Date(msg.sent_at), "dd/MM/yyyy HH:mm:ss"),
            msg.devices?.name || "-",
            msg.recipient_phone,
            msg.recipient_name || "-",
            msg.message_type,
            `"${(msg.message_content || "-").replace(/"/g, '""')}"`,
            msg.status,
            msg.campaign_name || "-"
          ].join(",")
        )
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `message-history-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Riwayat berhasil diekspor");
    } catch (error) {
      console.error("Error exporting:", error);
      toast.error("Gagal mengekspor data");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Yakin ingin menghapus riwayat pesan ini?")) return;

    try {
      const { error } = await supabase
        .from("message_history")
        .delete()
        .eq("id", messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      toast.success("Riwayat pesan berhasil dihapus");
    } catch (error: any) {
      console.error("Error deleting message:", error);
      toast.error("Gagal menghapus riwayat pesan");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
      case "delivered":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "read":
        return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image":
        return <Image className="w-4 h-4" />;
      case "video":
        return <Video className="w-4 h-4" />;
      case "document":
        return <FileText className="w-4 h-4" />;
      case "audio":
        return <Music className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      delivered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      read: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
    };

    return (
      <Badge variant="secondary" className={variants[status] || ""}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">📜 Riwayat Pesan</h1>
        <p className="text-muted-foreground">
          Lihat semua pesan yang telah dikirim melalui device Anda
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filter & Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="lg:col-span-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cari penerima, pesan, atau campaign..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Device Filter */}
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Device</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.name} ({device.phone_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="sent">Terkirim</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="read">Dibaca</SelectItem>
                <SelectItem value="failed">Gagal</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Semua Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="text">Teks</SelectItem>
                <SelectItem value="image">Gambar</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Dokumen</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>

            {/* Date From */}
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Dari Tanggal"
            />

            {/* Date To */}
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Sampai Tanggal"
            />

            {/* Export Button */}
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pesan</p>
                <p className="text-2xl font-bold">{filteredMessages.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-primary opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Terkirim</p>
                <p className="text-2xl font-bold text-green-600">
                  {filteredMessages.filter(m => m.status === 'sent' || m.status === 'delivered').length}
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Gagal</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredMessages.filter(m => m.status === 'failed').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {filteredMessages.filter(m => m.status === 'pending').length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message List */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-muted-foreground">Memuat riwayat pesan...</p>
          </CardContent>
        </Card>
      ) : filteredMessages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">Belum ada riwayat pesan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message) => (
            <Card key={message.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    {getTypeIcon(message.message_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className="font-semibold">{message.recipient_phone}</span>
                          {message.recipient_name && (
                            <span className="text-sm text-muted-foreground">
                              ({message.recipient_name})
                            </span>
                          )}
                          {message.is_group && (
                            <Badge variant="secondary">Grup</Badge>
                          )}
                        </div>

                        {message.message_content && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {message.message_content}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(message.sent_at), "dd MMM yyyy, HH:mm", { locale: idLocale })}
                          </div>

                          {message.devices && (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {message.devices.name}
                            </div>
                          )}

                          {message.campaign_name && (
                            <Badge variant="outline" className="text-xs">
                              📢 {message.campaign_name}
                            </Badge>
                          )}
                        </div>

                        {message.error_message && (
                          <div className="mt-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 p-2 rounded">
                            ⚠️ {message.error_message}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(message.status)}
                          {getStatusBadge(message.status)}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMessage(message.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
