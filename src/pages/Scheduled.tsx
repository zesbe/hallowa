import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Calendar, Clock, Send, XCircle, Edit, Trash2, CheckCircle2, Image as ImageIcon, Users, X, Upload, Loader2, Info, Zap, Globe, Eye } from "lucide-react";
import { BroadcastSafetyWarning } from "@/components/BroadcastSafetyWarning";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { ContactSelectorEnhanced } from "@/components/ContactSelectorEnhanced";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  convertLocalToUTC, 
  formatUTCToLocalInput, 
  formatUTCToLocalDisplay,
  getCurrentLocalTime,
  getUserTimezone,
  setUserTimezone,
  TIMEZONES,
  getTimezoneDisplay
} from "@/utils/timezone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useState, useCallback, startTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Broadcast {
  id: string;
  name: string;
  message: string;
  media_url?: string | null;
  status: string;
  sent_count: number;
  failed_count: number;
  scheduled_at: string | null;
  created_at: string;
  target_contacts: string[];
  delay_seconds?: number;
  randomize_delay?: boolean;
  batch_size?: number;
  pause_between_batches?: number;
  delay_type?: string;
  device_id?: string;
}

// Helper function to safely convert any value to a display string
const safeStringify = (value: any): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    // Handle objects - try to extract meaningful data
    if (value.toString && value.toString !== Object.prototype.toString) {
      return String(value);
    }
    // If it's a plain object, try to get a property that might be the actual value
    if (value.value !== undefined) {
      return safeStringify(value.value);
    }
    if (value.text !== undefined) {
      return safeStringify(value.text);
    }
    if (value.name !== undefined) {
      return safeStringify(value.name);
    }
    // Fallback to empty string for objects we can't handle
    return '';
  }
  return String(value);
};

export default function Scheduled() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [currentNumber, setCurrentNumber] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [userTimezone, setUserTimezoneState] = useState(getUserTimezone());
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    device_id: "",
    media_url: null as string | null,
    scheduled_at: "",
    delay_type: "auto" as string,
    delay_seconds: 5,
    randomize_delay: true,
    batch_size: 20,
    pause_between_batches: 60,
  });

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates with optimistic smooth updates
    const channel = supabase
      .channel('scheduled-broadcasts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcasts'
        },
        (payload) => {
          console.log('🔄 Realtime broadcast update:', payload.eventType);

          // Smooth optimistic updates without full refetch
          startTransition(() => {
            if (payload.eventType === 'INSERT') {
              const newBroadcast = payload.new as Broadcast;
              if (newBroadcast.scheduled_at) {
                setBroadcasts(prev => [newBroadcast, ...prev].sort((a, b) =>
                  new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
                ));
              }
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Broadcast;
              setBroadcasts(prev => prev.map(b => b.id === updated.id ? updated : b));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              setBroadcasts(prev => prev.filter(b => b.id !== deletedId));
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const { data: broadcastData, error: broadcastError } = await supabase
        .from("broadcasts")
        .select("*")
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });

      const { data: deviceData } = await supabase
        .from("devices")
        .select("*")
        .eq("status", "connected");

      const { data: contactData } = await supabase
        .from("contacts")
        .select("*")
        .order("name");

      if (broadcastError) throw broadcastError;
      
      startTransition(() => {
        setBroadcasts((broadcastData || []) as Broadcast[]);
        setDevices(deviceData || []);
        setContacts(contactData || []);
      });
    } catch (error: any) {
      toast.error("Gagal memuat data");
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const allTargets = [...manualNumbers, ...selectedContacts];
    if (allTargets.length === 0) {
      toast.error("Tambahkan minimal 1 nomor atau kontak");
      return;
    }

    if (!formData.scheduled_at) {
      toast.error("Pilih waktu jadwal pengiriman");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Convert local time to UTC before saving
      const utcScheduledAt = convertLocalToUTC(formData.scheduled_at, userTimezone);

      const { error } = await supabase.from("broadcasts").insert({
        user_id: user.id,
        device_id: formData.device_id,
        name: formData.name,
        message: formData.message,
        media_url: formData.media_url,
        scheduled_at: utcScheduledAt,
        target_contacts: allTargets,
        status: "draft",
        delay_type: formData.delay_type,
        delay_seconds: formData.delay_seconds,
        randomize_delay: formData.randomize_delay,
        batch_size: formData.batch_size,
        pause_between_batches: formData.pause_between_batches,
      });

      if (error) throw error;

      toast.success("Broadcast terjadwal berhasil dibuat");
      setCreateDialogOpen(false);
      setFormData({ 
        name: "", 
        message: "", 
        device_id: "", 
        media_url: null, 
        scheduled_at: "",
        delay_type: "auto",
        delay_seconds: 5,
        randomize_delay: true,
        batch_size: 20,
        pause_between_batches: 60,
      });
      setManualNumbers([]);
      setSelectedContacts([]);
      setCurrentNumber("");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const addManualNumber = () => {
    if (!currentNumber.trim()) return;
    if (manualNumbers.includes(currentNumber.trim())) {
      toast.error("Nomor sudah ditambahkan");
      return;
    }
    setManualNumbers([...manualNumbers, currentNumber.trim()]);
    setCurrentNumber("");
  };

  const removeManualNumber = (number: string) => {
    setManualNumbers(manualNumbers.filter((n) => n !== number));
  };

  const toggleContact = (phoneNumber: string) => {
    setSelectedContacts((prev) =>
      prev.includes(phoneNumber)
        ? prev.filter((p) => p !== phoneNumber)
        : [...prev, phoneNumber]
    );
  };

  const handleSelectAll = (phoneNumbers: string[]) => {
    setSelectedContacts(prev => {
      const newSet = new Set([...prev, ...phoneNumbers]);
      return Array.from(newSet);
    });
  };

  const handleClearAll = () => {
    setSelectedContacts([]);
  };

  const handleSelectByTag = (tag: string) => {
    const contactsWithTag = contacts.filter((c: any) => c.tags?.includes(tag));
    const phoneNumbers = contactsWithTag.map((c: any) => c.phone_number);
    handleSelectAll(phoneNumbers);
  };

  const filteredContactList = contacts.filter(
    (c) => {
      // Ensure contact data is valid string before filtering
      const name = safeStringify(c.name).toLowerCase();
      const phone = safeStringify(c.phone_number);
      const search = contactSearch.toLowerCase();
      return name.includes(search) || phone.includes(search);
    }
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("File terlalu besar", {
        description: "Maksimal ukuran file adalah 50MB"
      });
      return;
    }

    setUploadingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('broadcast-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('broadcast-media')
        .getPublicUrl(fileName);

      setFormData({ ...formData, media_url: publicUrl });
      toast.success("File berhasil diupload");
    } catch (error: any) {
      toast.error("Gagal upload file: " + error.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveFile = () => {
    setFormData({ ...formData, media_url: null });
  };

  const upcomingBroadcasts = broadcasts.filter(
    (b) => b.status === "draft" && new Date(b.scheduled_at!) > new Date()
  );

  const pastBroadcasts = broadcasts.filter(
    (b) => 
      (b.status !== "draft" || new Date(b.scheduled_at!) <= new Date()) &&
      b.status !== "draft"
  );

  const handleSendNow = async (broadcastId: string) => {
    setActionLoading(broadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ 
          status: "processing",
          scheduled_at: null 
        })
        .eq("id", broadcastId);

      if (error) throw error;

      toast.success("Broadcast dimulai!", {
        description: "Pesan sedang dikirim ke semua kontak terpilih."
      });
      fetchData();
    } catch (error: any) {
      toast.error("Gagal mengirim broadcast: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditSchedule = (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    // Convert UTC to local time for editing
    const localTime = broadcast.scheduled_at ? formatUTCToLocalInput(broadcast.scheduled_at, userTimezone) : "";
    setNewScheduledTime(localTime);
    setEditDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedBroadcast || !newScheduledTime) return;

    setActionLoading(selectedBroadcast.id);
    try {
      // Convert local time to UTC before saving
      const utcScheduledAt = convertLocalToUTC(newScheduledTime, userTimezone);
      
      const { error } = await supabase
        .from("broadcasts")
        .update({ scheduled_at: utcScheduledAt })
        .eq("id", selectedBroadcast.id);

      if (error) throw error;

      toast.success("Jadwal diperbarui");
      setEditDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error("Gagal mengupdate jadwal: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSchedule = async (broadcastId: string) => {
    setActionLoading(broadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ 
          status: "cancelled",
          scheduled_at: null 
        })
        .eq("id", broadcastId);

      if (error) throw error;

      toast.success("Broadcast dibatalkan");
      fetchData();
    } catch (error: any) {
      toast.error("Gagal membatalkan: " + error.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedBroadcast) return;
    
    setActionLoading(selectedBroadcast.id);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .delete()
        .eq("id", selectedBroadcast.id);

      if (error) throw error;

      toast.success("Broadcast dihapus");
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menghapus: " + error.message);
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setSelectedBroadcast(null);
    }
  };

  const confirmDelete = (broadcast: Broadcast) => {
    setSelectedBroadcast(broadcast);
    setDeleteDialogOpen(true);
  };

  const formatDateTime = (dateString: string) => {
    // Use timezone-aware formatting
    return formatUTCToLocalDisplay(dateString, userTimezone, 'EEE, dd MMM yyyy HH:mm');
  };

  const handleTimezoneChange = (newTimezone: string) => {
    setUserTimezoneState(newTimezone);
    setUserTimezone(newTimezone);
    toast.success(`Timezone diubah ke ${TIMEZONES.find(tz => tz.value === newTimezone)?.label}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-foreground";
      case "processing":
        return "bg-warning text-warning-foreground";
      case "failed":
        return "bg-destructive text-destructive-foreground";
      case "cancelled":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-primary text-primary-foreground";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "Terkirim";
      case "processing":
        return "Mengirim";
      case "failed":
        return "Gagal";
      case "cancelled":
        return "Dibatalkan";
      default:
        return "Terjadwal";
    }
  };

  const BroadcastCard = ({ broadcast, showActions = true }: { broadcast: Broadcast; showActions?: boolean }) => {
    const handleCardClick = (e: React.MouseEvent) => {
      // Don't open detail dialog if clicking on action buttons
      if ((e.target as HTMLElement).closest('button')) {
        return;
      }
      setSelectedBroadcast(broadcast);
      setDetailDialogOpen(true);
    };

    return (
      <Card
        key={broadcast.id}
        className="hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer overflow-hidden bg-card border-border"
        onClick={handleCardClick}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-bold mb-2 truncate text-foreground">{broadcast.name}</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Badge className={getStatusColor(broadcast.status)} variant="default">
                {getStatusText(broadcast.status)}
              </Badge>
              {broadcast.scheduled_at && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatUTCToLocalDisplay(broadcast.scheduled_at, userTimezone, 'dd MMM HH:mm')}</span>
                </Badge>
              )}
            </div>
          </div>
          {showActions && (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditSchedule(broadcast);
                }}
                disabled={actionLoading === broadcast.id}
                className="h-9 w-9"
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmDelete(broadcast);
                }}
                disabled={actionLoading === broadcast.id}
                className="h-9 w-9"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Message Preview */}
        <div className="bg-muted/80 rounded-lg p-3 border border-border">
          <p className="text-sm line-clamp-2 text-foreground">{broadcast.message}</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {broadcast.media_url && (
            <Badge variant="outline" className="text-xs">
              <ImageIcon className="w-3 h-3 mr-1" />
              Media
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {Array.isArray(broadcast.target_contacts) ? broadcast.target_contacts.length : 0} kontak
          </Badge>
        </div>

        {broadcast.status !== "draft" && (
          <div className="flex gap-4 text-sm pt-2 border-t">
            <div className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span>{broadcast.sent_count || 0} terkirim</span>
            </div>
            <div className="flex items-center gap-1.5 text-destructive">
              <XCircle className="w-4 h-4" />
              <span>{broadcast.failed_count || 0} gagal</span>
            </div>
          </div>
        )}

        {showActions && broadcast.status === "draft" && (
          <div className="flex flex-col sm:flex-row gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="default"
              className="flex-1 h-11 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleSendNow(broadcast.id);
              }}
              disabled={actionLoading === broadcast.id}
            >
              <Send className="w-4 h-4 mr-2" />
              Kirim Sekarang
            </Button>
            <Button
              size="default"
              variant="outline"
              className="h-11 text-sm sm:w-auto"
              onClick={(e) => {
                e.stopPropagation();
                handleCancelSchedule(broadcast.id);
              }}
              disabled={actionLoading === broadcast.id}
            >
              Batalkan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">Memuat broadcast terjadwal...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Jadwal Broadcast</h1>
            <p className="text-sm text-muted-foreground">
              Buat dan kelola broadcast terjadwal
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Select value={userTimezone} onValueChange={handleTimezoneChange}>
              <SelectTrigger className="h-9 w-full sm:w-[220px] text-xs bg-card text-card-foreground border-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[280px] bg-popover text-popover-foreground border-border z-50">
                <ScrollArea className="h-[260px]">
                  {TIMEZONES.map((tz) => (
                    <SelectItem 
                      key={tz.value} 
                      value={tz.value} 
                      className="text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      {tz.label}
                    </SelectItem>
                  ))}
                </ScrollArea>
              </SelectContent>
            </Select>
          </div>
        </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all">
                <Plus className="w-5 h-5 mr-2" />
                Buat Broadcast Terjadwal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-full md:max-w-2xl h-[100dvh] md:h-auto max-h-[90vh] p-0 gap-0 flex flex-col">
              <div className="flex-shrink-0 bg-background border-b px-4 md:px-6 py-4">
                <DialogHeader>
                  <DialogTitle className="text-lg md:text-xl">Buat Broadcast Terjadwal</DialogTitle>
                  <DialogDescription className="text-sm">
                    Atur jadwal pengiriman broadcast otomatis
                  </DialogDescription>
                </DialogHeader>
              </div>
              <form onSubmit={handleCreate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="space-y-4 md:space-y-6 p-4 md:p-6">
                    <div className="space-y-2">
                    <Label htmlFor="name" className="text-base md:text-sm">Nama Campaign</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Promo Akhir Tahun"
                      className="h-12 md:h-10 text-base"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device" className="text-base md:text-sm">Device</Label>
                    <Select
                      value={formData.device_id}
                      onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                      required
                    >
                      <SelectTrigger className="h-12 md:h-10 text-base">
                        <SelectValue placeholder="Pilih device" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((device) => (
                          <SelectItem key={device.id} value={device.id} className="text-base md:text-sm py-3 md:py-2">
                            {device.device_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scheduled" className="text-base md:text-sm">Jadwal Pengiriman ({getTimezoneDisplay(userTimezone)})</Label>
                    <Input
                      id="scheduled"
                      type="datetime-local"
                      value={formData.scheduled_at}
                      onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                      min={getCurrentLocalTime(userTimezone)}
                      className="h-12 md:h-10 text-base"
                      required
                    />
                    <p className="text-xs md:text-xs text-muted-foreground flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Waktu lokal Anda: {TIMEZONES.find(tz => tz.value === userTimezone)?.label}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-base md:text-sm">Pesan</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tulis pesan broadcast..."
                      rows={5}
                      className="text-base resize-none"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file" className="text-base md:text-sm">File Media (Opsional)</Label>
                    {formData.media_url ? (
                      <div className="flex items-center gap-3 p-4 md:p-3 border rounded-lg bg-accent/50">
                        <ImageIcon className="w-5 h-5 md:w-4 md:h-4 text-primary" />
                        <span className="text-base md:text-sm flex-1 truncate">File terlampir</span>
                        <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile} className="h-10 w-10 md:h-8 md:w-8">
                          <X className="w-5 h-5 md:w-4 md:h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Input
                          id="file"
                          type="file"
                          accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                          onChange={handleFileUpload}
                          disabled={uploadingFile}
                          className="hidden"
                        />
                        <Label htmlFor="file" className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-center gap-3 p-4 md:p-3 border-2 border-dashed rounded-lg hover:bg-accent transition-colors active:scale-95">
                            {uploadingFile ? (
                              <Loader2 className="w-5 h-5 md:w-4 md:h-4 animate-spin" />
                            ) : (
                              <Upload className="w-5 h-5 md:w-4 md:h-4" />
                            )}
                            <span className="text-base md:text-sm font-medium">
                              {uploadingFile ? "Mengupload..." : "Pilih file"}
                            </span>
                          </div>
                        </Label>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Mendukung gambar, video, audio, PDF, dokumen (Max 50MB)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-base md:text-sm">Penerima</Label>
                    <Tabs defaultValue="manual" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 h-12 md:h-10">
                        <TabsTrigger value="manual" className="text-base md:text-sm">Input Manual</TabsTrigger>
                        <TabsTrigger value="contacts" className="text-base md:text-sm">Dari Kontak</TabsTrigger>
                      </TabsList>
                      <TabsContent value="manual" className="space-y-3 mt-4">
                        <div className="flex gap-2">
                          <Input
                            placeholder="628123456789"
                            value={currentNumber}
                            onChange={(e) => setCurrentNumber(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addManualNumber())}
                            className="h-12 md:h-10 text-base"
                          />
                          <Button type="button" onClick={addManualNumber} size="lg" className="h-12 w-12 md:h-10 md:w-10 md:size-default">
                            <Plus className="w-5 h-5 md:w-4 md:h-4" />
                          </Button>
                        </div>
                        {manualNumbers.length > 0 && (
                          <ScrollArea className="h-32 border rounded-lg p-3">
                            <div className="flex flex-wrap gap-2">
                              {manualNumbers.map((num) => (
                                <Badge key={num} variant="secondary" className="gap-1 text-sm py-1.5 px-2.5">
                                  {safeStringify(num)}
                                  <X
                                    className="w-3.5 h-3.5 cursor-pointer hover:text-destructive"
                                    onClick={() => removeManualNumber(num)}
                                  />
                                </Badge>
                              ))}
                            </div>
                          </ScrollArea>
                        )}
                      </TabsContent>
                      <TabsContent value="contacts" className="space-y-3 mt-4">
                        <ContactSelectorEnhanced
                          contacts={contacts}
                          selectedContacts={selectedContacts}
                          onToggleContact={toggleContact}
                          onSelectByTag={handleSelectByTag}
                          onSelectAll={handleSelectAll}
                          onClearAll={handleClearAll}
                        />
                      </TabsContent>
                    </Tabs>
                    <div className="flex items-center justify-between bg-accent/50 rounded-lg p-3">
                      <span className="text-sm text-muted-foreground">Total penerima</span>
                      <Badge variant="secondary" className="text-base font-semibold">
                        {manualNumbers.length + selectedContacts.length}
                      </Badge>
                    </div>
                  </div>

                  {/* Anti-Ban Settings */}
                  <div className="space-y-4 p-4 border rounded-lg bg-accent/20">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-base">Pengaturan Anti-Ban</h3>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-base md:text-sm">Mode Delay</Label>
                      <Select
                        value={formData.delay_type}
                        onValueChange={(value) => setFormData({ ...formData, delay_type: value })}
                      >
                        <SelectTrigger className="h-12 md:h-10 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto" className="text-base md:text-sm py-3 md:py-2">
                            🤖 Auto (Direkomendasikan)
                          </SelectItem>
                          <SelectItem value="manual" className="text-base md:text-sm py-3 md:py-2">
                            ⚙️ Manual
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Mode Auto akan menyesuaikan delay optimal berdasarkan jumlah penerima
                      </p>
                    </div>

                    {formData.delay_type === 'manual' && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-base md:text-sm">Delay Antar Pesan</Label>
                            <Badge variant="secondary">{formData.delay_seconds}s</Badge>
                          </div>
                          <Slider
                            value={[formData.delay_seconds]}
                            onValueChange={(value) => setFormData({ ...formData, delay_seconds: value[0] })}
                            min={1}
                            max={30}
                            step={1}
                            className="py-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            Waktu jeda antara setiap pesan (1-30 detik)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-base md:text-sm">Batch Size</Label>
                            <Badge variant="secondary">{formData.batch_size} pesan</Badge>
                          </div>
                          <Slider
                            value={[formData.batch_size]}
                            onValueChange={(value) => setFormData({ ...formData, batch_size: value[0] })}
                            min={10}
                            max={50}
                            step={5}
                            className="py-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            Jumlah pesan sebelum pause otomatis
                          </p>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-base md:text-sm">Pause Antar Batch</Label>
                            <Badge variant="secondary">{formData.pause_between_batches}s</Badge>
                          </div>
                          <Slider
                            value={[formData.pause_between_batches]}
                            onValueChange={(value) => setFormData({ ...formData, pause_between_batches: value[0] })}
                            min={30}
                            max={300}
                            step={30}
                            className="py-2"
                          />
                          <p className="text-xs text-muted-foreground">
                            Waktu jeda setelah mengirim 1 batch (30-300 detik)
                          </p>
                        </div>
                      </>
                    )}

                    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
                      <div className="flex-1">
                        <Label htmlFor="randomize" className="text-base md:text-sm font-medium cursor-pointer">
                          Randomize Delay
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Variasi delay untuk tampak lebih natural
                        </p>
                      </div>
                      <Switch
                        id="randomize"
                        checked={formData.randomize_delay}
                        onCheckedChange={(checked) => setFormData({ ...formData, randomize_delay: checked })}
                      />
                    </div>

                    {(manualNumbers.length + selectedContacts.length) > 0 && (
                      <BroadcastSafetyWarning
                        contactCount={manualNumbers.length + selectedContacts.length}
                        delaySeconds={formData.delay_seconds}
                        delayType={formData.delay_type}
                      />
                    )}
                  </div>

                  {/* WhatsApp Preview */}
                  {formData.message && (
                    <div className="space-y-2">
                      <Label className="text-base md:text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Preview Pesan
                      </Label>
                      <WhatsAppPreview
                        message={formData.message}
                        hasMedia={!!formData.media_url}
                        mediaUrl={formData.media_url}
                      />
                    </div>
                  )}
                  </div>
                </ScrollArea>
                <div className="sticky bottom-0 bg-background border-t p-4 md:p-6 shadow-lg">
                  <Button type="submit" className="w-full h-12 md:h-10 text-base md:text-sm bg-gradient-to-r from-primary to-secondary">
                    <Calendar className="w-5 h-5 md:w-4 md:h-4 mr-2" />
                    Jadwalkan Broadcast
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-11 mb-4 bg-muted">
            <TabsTrigger 
              value="upcoming" 
              className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Jadwal ({upcomingBroadcasts.length})
            </TabsTrigger>
            <TabsTrigger 
              value="past" 
              className="text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-foreground"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Riwayat ({pastBroadcasts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {upcomingBroadcasts.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-foreground text-center font-medium">
                    Belum ada broadcast terjadwal
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-2">
                    Klik tombol di atas untuk membuat broadcast terjadwal pertama Anda
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingBroadcasts.map((broadcast) => (
                  <BroadcastCard key={broadcast.id} broadcast={broadcast} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4 mt-6">
            {pastBroadcasts.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-foreground text-center font-medium">
                    Belum ada riwayat broadcast terjadwal
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pastBroadcasts.map((broadcast) => (
                  <BroadcastCard key={broadcast.id} broadcast={broadcast} showActions={false} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Schedule Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit Jadwal Broadcast</DialogTitle>
            <DialogDescription className="text-sm">
              Ubah waktu pengiriman broadcast: {selectedBroadcast?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-schedule" className="text-base md:text-sm">Jadwal Baru ({getTimezoneDisplay(userTimezone)})</Label>
              <Input
                id="new-schedule"
                type="datetime-local"
                value={newScheduledTime}
                onChange={(e) => setNewScheduledTime(e.target.value)}
                min={getCurrentLocalTime(userTimezone)}
                className="h-12 md:h-10 text-base"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {TIMEZONES.find(tz => tz.value === userTimezone)?.label}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11 md:h-10 text-base md:text-sm"
              onClick={() => setEditDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1 h-11 md:h-10 text-base md:text-sm"
              onClick={handleSaveSchedule}
              disabled={!newScheduledTime || actionLoading === selectedBroadcast?.id}
            >
              Simpan
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              Broadcast "{selectedBroadcast?.name}" akan dihapus secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-full md:max-w-2xl h-[100dvh] md:h-auto max-h-[90vh] p-0 gap-0 flex flex-col">
          <div className="flex-shrink-0 bg-background border-b px-4 md:px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              <DialogHeader className="flex-1">
                <DialogTitle className="text-lg md:text-xl">Detail Broadcast</DialogTitle>
                <DialogDescription className="text-sm">
                  Informasi lengkap broadcast terjadwal
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDetailDialogOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-accent flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <ScrollArea className="flex-1 overflow-y-auto">
            {selectedBroadcast && (
              <div className="space-y-6 p-4 md:p-6">
                {/* Broadcast Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                    <Info className="w-5 h-5 text-primary" />
                    Informasi Broadcast
                  </h3>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Nama Campaign</Label>
                          <p className="font-medium mt-1 text-foreground">{selectedBroadcast.name}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Status</Label>
                          <div className="mt-1">
                            <Badge className={getStatusColor(selectedBroadcast.status)}>
                              {getStatusText(selectedBroadcast.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Dibuat</Label>
                          <p className="text-sm mt-1 text-foreground">
                            {formatDateTime(selectedBroadcast.created_at)}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Dijadwalkan</Label>
                          <p className="text-sm mt-1 text-foreground">
                            {selectedBroadcast.scheduled_at ? formatDateTime(selectedBroadcast.scheduled_at) : '-'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground">Target</Label>
                          <p className="text-2xl font-bold text-primary mt-1">
                            {Array.isArray(selectedBroadcast.target_contacts) ? selectedBroadcast.target_contacts.length : 0}
                          </p>
                        </div>
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground">Terkirim</Label>
                          <p className="text-2xl font-bold text-success mt-1">
                            {selectedBroadcast.sent_count || 0}
                          </p>
                        </div>
                        <div className="text-center">
                          <Label className="text-xs text-muted-foreground">Gagal</Label>
                          <p className="text-2xl font-bold text-destructive mt-1">
                            {selectedBroadcast.failed_count || 0}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Message Preview */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                    <Send className="w-5 h-5 text-primary" />
                    Preview Pesan
                  </h3>
                  <Card className="bg-card border-border">
                    <CardContent className="pt-6">
                      {selectedBroadcast.media_url && (
                        <div className="mb-4">
                          <img
                            src={selectedBroadcast.media_url}
                            alt="Media preview"
                            className="w-full max-h-64 object-cover rounded-lg"
                          />
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-sm text-foreground">{selectedBroadcast.message}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Anti-Ban Settings */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Pengaturan Anti-Ban
                  </h3>
                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Mode Delay</Label>
                          <p className="font-medium mt-1">
                            {selectedBroadcast.delay_type === 'auto' ? '🤖 Auto' : '⚙️ Manual'}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Delay Antar Pesan</Label>
                          <p className="font-medium mt-1">{selectedBroadcast.delay_seconds || 5} detik</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Batch Size</Label>
                          <p className="font-medium mt-1">{selectedBroadcast.batch_size || 20} pesan</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Pause Antar Batch</Label>
                          <p className="font-medium mt-1">{selectedBroadcast.pause_between_batches || 60} detik</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <CheckCircle2 className={`w-4 h-4 ${selectedBroadcast.randomize_delay ? 'text-success' : 'text-muted-foreground'}`} />
                        <Label className="text-sm">Randomize Delay {selectedBroadcast.randomize_delay ? 'Aktif' : 'Tidak Aktif'}</Label>
                      </div>

                      {/* Estimasi */}
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-4">
                        <Label className="text-xs text-muted-foreground">Estimasi Durasi Pengiriman</Label>
                        <p className="text-2xl font-bold text-primary mt-2">
                          {(() => {
                            const targetCount = Array.isArray(selectedBroadcast.target_contacts) ? selectedBroadcast.target_contacts.length : 0;
                            const delaySeconds = selectedBroadcast.delay_seconds || 5;
                            const estimatedMinutes = Math.ceil((targetCount * delaySeconds) / 60);
                            if (estimatedMinutes < 60) {
                              return `~${estimatedMinutes} menit`;
                            } else {
                              return `~${Math.floor(estimatedMinutes / 60)} jam ${estimatedMinutes % 60} menit`;
                            }
                          })()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Berdasarkan {Array.isArray(selectedBroadcast.target_contacts) ? selectedBroadcast.target_contacts.length : 0} penerima dengan delay {selectedBroadcast.delay_seconds || 5}s per pesan
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Actions */}
                {selectedBroadcast.status === "draft" && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button
                      size="default"
                      className="flex-1 h-11 md:h-10 text-base md:text-sm"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        handleSendNow(selectedBroadcast.id);
                      }}
                      disabled={actionLoading === selectedBroadcast.id}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Kirim Sekarang
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="h-11 md:h-10 text-base md:text-sm"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        handleEditSchedule(selectedBroadcast);
                      }}
                      disabled={actionLoading === selectedBroadcast.id}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Jadwal
                    </Button>
                    <Button
                      size="default"
                      variant="outline"
                      className="h-11 md:h-10 text-base md:text-sm"
                      onClick={() => {
                        setDetailDialogOpen(false);
                        handleCancelSchedule(selectedBroadcast.id);
                      }}
                      disabled={actionLoading === selectedBroadcast.id}
                    >
                      Batalkan
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}