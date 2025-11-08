import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Clock, Users, Calendar, Smartphone, Edit, Power, PowerOff, History, RefreshCw, Loader2, Copy, BarChart3, Eye, Globe, Image as ImageIcon } from "lucide-react";
import { useEffect, useState, startTransition, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { previewMessageVariables } from "@/utils/messageVariables";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AutoPostSchedule {
  id: string;
  name: string;
  message: string;
  media_url?: string;
  target_groups: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule_time: string;
  timezone?: string;
  selected_days?: number[];
  random_delay?: boolean;
  delay_minutes?: number;
  is_active: boolean;
  send_count?: number;
  failed_count?: number;
  created_at: string;
  device_id: string;
  user_id: string;
}

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  is_group: boolean;
}

export default function AutoPost() {
  const [schedules, setSchedules] = useState<AutoPostSchedule[]>([]);
  const [groups, setGroups] = useState<Contact[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); // Start false for instant UI
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [editingSchedule, setEditingSchedule] = useState<AutoPostSchedule | null>(null);
  const [viewingLogs, setViewingLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    media_url: "",
    target_groups: [] as string[],
    frequency: "daily" as 'daily' | 'weekly' | 'monthly',
    schedule_time: "09:00",
    timezone: "Asia/Jakarta",
    selected_days: [0, 1, 2, 3, 4, 5, 6] as number[], // All days by default
    random_delay: false,
    delay_minutes: 5,
    is_active: true,
  });

  useEffect(() => {
    fetchDevices();
    fetchSchedules();

    // Realtime subscription for schedules
    const scheduleChannel = supabase
      .channel('auto-post-schedules-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_post_schedules'
        },
        (payload) => {
          console.log('🔄 Auto-post schedule update:', payload.eventType);

          startTransition(() => {
            if (payload.eventType === 'INSERT') {
              const newSchedule = payload.new as AutoPostSchedule;
              setSchedules(prev => [newSchedule, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              const updated = payload.new as AutoPostSchedule;
              setSchedules(prev => prev.map(s => s.id === updated.id ? updated : s));
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              setSchedules(prev => prev.filter(s => s.id !== deletedId));
            }
          });
        }
      )
      .subscribe();

    // Realtime subscription for contacts/groups
    const contactsChannel = supabase
      .channel('contacts-groups-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        (payload) => {
          console.log('🔄 Contacts/Groups update:', payload.eventType);

          const contact = (payload.new || payload.old) as Contact;

          // Only update if it's a group and belongs to selected device
          if (contact.is_group && contact.device_id === selectedDevice) {
            startTransition(() => {
              if (payload.eventType === 'INSERT') {
                const newGroup = payload.new as Contact;
                setGroups(prev => [...prev, newGroup].sort((a, b) =>
                  (a.name || a.phone_number).localeCompare(b.name || b.phone_number)
                ));
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as Contact;
                setGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
              } else if (payload.eventType === 'DELETE') {
                const deletedId = payload.old?.id;
                setGroups(prev => prev.filter(g => g.id !== deletedId));
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(contactsChannel);
    };
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedDevice) {
      fetchGroups(selectedDevice);
    } else {
      setGroups([]);
    }
  }, [selectedDevice]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      startTransition(() => {
        setDevices(data || []);

        // Auto-select first connected device if available
        if (data && data.length > 0 && !selectedDevice) {
          const connectedDevice = data.find(d => d.status === 'connected');
          setSelectedDevice(connectedDevice ? connectedDevice.id : data[0].id);
        }
      });
    } catch (error: any) {
      toast.error("Gagal memuat device");
    }
  };

  const fetchGroups = async (deviceId: string) => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("is_group", true)
        .eq("device_id", deviceId)
        .order("name");

      if (error) throw error;

      startTransition(() => {
        setGroups(data || []);
      });
    } catch (error: any) {
      toast.error("Gagal memuat grup WhatsApp");
    }
  };

  const fetchSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from("auto_post_schedules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      startTransition(() => {
        // Transform data to match interface
        const transformedData = (data || []).map((item: any) => ({
          ...item,
          target_groups: Array.isArray(item.target_groups)
            ? item.target_groups
            : []
        }));

        setSchedules(transformedData);
      });
    } catch (error: any) {
      toast.error("Gagal memuat jadwal");
    }
  };

  // Sync groups from WhatsApp/Baileys to Supabase
  const handleSyncGroups = async () => {
    if (!selectedDevice) {
      toast.error("Pilih device terlebih dahulu");
      return;
    }

    const device = devices.find(d => d.id === selectedDevice);
    if (!device) {
      toast.error("Device tidak ditemukan");
      return;
    }

    if (device.status !== 'connected') {
      toast.error("Device harus dalam status terhubung untuk sync grup");
      return;
    }

    setSyncing(true);
    toast.info("Memulai sync grup WhatsApp...", { duration: 2000 });

    try {
      // Call edge function to sync groups from Baileys
      const { data, error } = await supabase.functions.invoke('sync-whatsapp-groups', {
        body: { device_id: selectedDevice }
      });

      if (error) {
        // Extract detailed error message from response
        const errorMessage = data?.error || error.message || 'Unknown error';
        console.error("Sync groups error:", error, "Response data:", data);
        throw new Error(errorMessage);
      }

      const groupCount = data?.groups_synced || 0;

      if (groupCount === 0) {
        toast.info("ℹ️ Tidak ada grup WhatsApp ditemukan di device ini", {
          duration: 4000,
          description: 'Pastikan device sudah tergabung di grup WhatsApp'
        });
      } else {
        toast.success(`✅ Berhasil sync ${groupCount} grup WhatsApp!`, {
          duration: 4000,
          description: 'Grup akan muncul dalam beberapa detik'
        });
      }

      // Refresh groups after a short delay to ensure database is updated
      setTimeout(() => {
        fetchGroups(selectedDevice);
      }, 1000);

    } catch (error: any) {
      console.error("Sync groups error:", error);

      // Display detailed error message
      let errorMsg = error.message || 'Unknown error';

      // Add helpful hints based on error message
      if (errorMsg.includes('BAILEYS_SERVICE_URL')) {
        errorMsg += '\n\nℹ️ Solusi: Set BAILEYS_SERVICE_URL di Supabase Edge Functions environment variables';
      } else if (errorMsg.includes('Device not connected')) {
        errorMsg += '\n\nℹ️ Solusi: Pastikan device dalam status "Connected"';
      } else if (errorMsg.includes('Baileys service')) {
        errorMsg += '\n\nℹ️ Solusi: Pastikan Railway service sudah running';
      }

      toast.error(`Gagal sync grup: ${errorMsg}`, {
        duration: 6000,
        style: { whiteSpace: 'pre-line' }
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      target_groups: prev.target_groups.includes(groupId)
        ? prev.target_groups.filter(id => id !== groupId)
        : [...prev.target_groups, groupId]
    }));
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.message) {
      toast.error("Nama dan pesan harus diisi");
      return;
    }

    if (formData.target_groups.length === 0) {
      toast.error("Pilih minimal 1 grup WhatsApp");
      return;
    }

    if (!selectedDevice) {
      toast.error("Pilih device terlebih dahulu");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("auto_post_schedules")
        .insert({
          user_id: user.id,
          device_id: selectedDevice,
          name: formData.name,
          message: formData.message,
          media_url: formData.media_url || null,
          target_groups: formData.target_groups,
          frequency: formData.frequency,
          schedule_time: formData.schedule_time,
          timezone: formData.timezone,
          selected_days: formData.selected_days,
          random_delay: formData.random_delay,
          delay_minutes: formData.delay_minutes,
          is_active: formData.is_active,
        });

      if (error) throw error;

      toast.success("Jadwal auto post berhasil dibuat!");
      setFormData({
        name: "",
        message: "",
        media_url: "",
        target_groups: [],
        frequency: "daily",
        schedule_time: "09:00",
        timezone: "Asia/Jakarta",
        selected_days: [0, 1, 2, 3, 4, 5, 6],
        random_delay: false,
        delay_minutes: 5,
        is_active: true,
      });
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat jadwal");
    }
  };

  const handleToggleActive = async (scheduleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("auto_post_schedules")
        .update({ is_active: !currentStatus })
        .eq("id", scheduleId);

      if (error) throw error;

      toast.success(currentStatus ? "Jadwal dinonaktifkan" : "Jadwal diaktifkan");
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal mengubah status");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string, scheduleName: string) => {
    if (!confirm(`Yakin ingin menghapus jadwal "${scheduleName}"?`)) return;

    try {
      const { error } = await supabase
        .from("auto_post_schedules")
        .delete()
        .eq("id", scheduleId);

      if (error) throw error;

      toast.success("Jadwal berhasil dihapus");
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus jadwal");
    }
  };

  const handleEditSchedule = (schedule: AutoPostSchedule) => {
    setEditingSchedule(schedule);
    setSelectedDevice(schedule.device_id);
    fetchGroups(schedule.device_id);
    setFormData({
      name: schedule.name,
      message: schedule.message,
      media_url: schedule.media_url || "",
      target_groups: schedule.target_groups,
      frequency: schedule.frequency,
      schedule_time: schedule.schedule_time,
      timezone: schedule.timezone || "Asia/Jakarta",
      selected_days: schedule.selected_days || [0, 1, 2, 3, 4, 5, 6],
      random_delay: schedule.random_delay || false,
      delay_minutes: schedule.delay_minutes || 5,
      is_active: schedule.is_active,
    });
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingSchedule) return;

    try {
      const { error } = await supabase
        .from("auto_post_schedules")
        .update({
          name: formData.name,
          message: formData.message,
          media_url: formData.media_url || null,
          target_groups: formData.target_groups,
          frequency: formData.frequency,
          schedule_time: formData.schedule_time,
          timezone: formData.timezone,
          selected_days: formData.selected_days,
          random_delay: formData.random_delay,
          delay_minutes: formData.delay_minutes,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingSchedule.id);

      if (error) throw error;

      toast.success("Jadwal berhasil diperbarui!");
      setEditingSchedule(null);
      setFormData({
        name: "",
        message: "",
        media_url: "",
        target_groups: [],
        frequency: "daily",
        schedule_time: "09:00",
        timezone: "Asia/Jakarta",
        selected_days: [0, 1, 2, 3, 4, 5, 6],
        random_delay: false,
        delay_minutes: 5,
        is_active: true,
      });
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui jadwal");
    }
  };

  const handleDuplicateSchedule = async (schedule: AutoPostSchedule) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("auto_post_schedules")
        .insert({
          user_id: user.id,
          device_id: schedule.device_id,
          name: `${schedule.name} (Copy)`,
          message: schedule.message,
          media_url: schedule.media_url,
          target_groups: schedule.target_groups,
          frequency: schedule.frequency,
          schedule_time: schedule.schedule_time,
          timezone: schedule.timezone,
          selected_days: schedule.selected_days,
          random_delay: schedule.random_delay,
          delay_minutes: schedule.delay_minutes,
          is_active: false, // Start as inactive
        });

      if (error) throw error;

      toast.success("Jadwal berhasil diduplikasi!");
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal menduplikasi jadwal");
    }
  };

  const handleViewLogs = async (scheduleId: string) => {
    setViewingLogs(scheduleId);
    try {
      const { data, error } = await supabase
        .from("auto_post_logs")
        .select("*")
        .eq("schedule_id", scheduleId)
        .order("sent_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat log");
      setLogs([]);
    }
  };

  const formatNextSendTime = (schedule: AutoPostSchedule) => {
    if (!schedule.is_active) return "Nonaktif";

    // This would ideally come from next_send_at column
    // For now, just show the schedule time
    return `Hari ini pukul ${schedule.schedule_time} ${schedule.timezone || 'WIB'}`;
  };

  const getDayNames = (days: number[]) => {
    const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    return days.map(d => dayNames[d]).join(', ');
  };

  const stats = {
    total_schedules: schedules.length,
    active_schedules: schedules.filter(s => s.is_active).length,
    total_groups: groups.length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2">
            Auto Post ke Grup WhatsApp
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Jadwalkan pesan otomatis ke grup WhatsApp secara berkala
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="p-4">
              <CardDescription className="text-xs">Total Jadwal</CardDescription>
              <CardTitle className="text-2xl">{stats.total_schedules}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardDescription className="text-xs">Aktif</CardDescription>
              <CardTitle className="text-2xl">{stats.active_schedules}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="p-4">
              <CardDescription className="text-xs">Total Grup</CardDescription>
              <CardTitle className="text-2xl">{stats.total_groups}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Create/Edit Schedule Form */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {editingSchedule ? (
                    <><Edit className="w-5 h-5" />Edit Jadwal Auto Post</>
                  ) : (
                    <><Plus className="w-5 h-5" />Buat Jadwal Auto Post Baru</>
                  )}
                </CardTitle>
                <CardDescription>
                  {editingSchedule
                    ? 'Perbarui pengaturan jadwal auto post'
                    : 'Atur pesan yang akan dikirim otomatis ke grup-grup WhatsApp'}
                </CardDescription>
              </div>
              {editingSchedule && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingSchedule(null);
                    setFormData({
                      name: "",
                      message: "",
                      media_url: "",
                      target_groups: [],
                      frequency: "daily",
                      schedule_time: "09:00",
                      timezone: "Asia/Jakarta",
                      selected_days: [0, 1, 2, 3, 4, 5, 6],
                      random_delay: false,
                      delay_minutes: 5,
                      is_active: true,
                    });
                  }}
                >
                  Batal
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={editingSchedule ? handleUpdateSchedule : handleCreateSchedule} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="device">Pilih Device WhatsApp</Label>
                    <Select
                      value={selectedDevice}
                      onValueChange={setSelectedDevice}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih device..." />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Tidak ada device. Hubungkan device terlebih dahulu.
                          </div>
                        ) : (
                          devices.map((device) => (
                            <SelectItem key={device.id} value={device.id}>
                              <div className="flex items-center gap-2">
                                <Smartphone className="w-4 h-4" />
                                {device.device_name} - {device.status === "connected" ? "🟢 Terhubung" : "🔴 Terputus"}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Pilih device untuk melihat daftar grup WhatsApp
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Jadwal</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Contoh: Promo Harian"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frekuensi</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                        setFormData({ ...formData, frequency: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Harian</SelectItem>
                        <SelectItem value="weekly">Mingguan</SelectItem>
                        <SelectItem value="monthly">Bulanan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Day Selection for Weekly */}
                  {formData.frequency === 'weekly' && (
                    <div className="space-y-2">
                      <Label>Pilih Hari</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: 'Min', value: 0 },
                          { label: 'Sen', value: 1 },
                          { label: 'Sel', value: 2 },
                          { label: 'Rab', value: 3 },
                          { label: 'Kam', value: 4 },
                          { label: 'Jum', value: 5 },
                          { label: 'Sab', value: 6 },
                        ].map((day) => (
                          <Button
                            key={day.value}
                            type="button"
                            variant={formData.selected_days.includes(day.value) ? "default" : "outline"}
                            size="sm"
                            className="transition-all duration-200"
                            onClick={() => {
                              const days = formData.selected_days.includes(day.value)
                                ? formData.selected_days.filter(d => d !== day.value)
                                : [...formData.selected_days, day.value].sort();
                              setFormData({ ...formData, selected_days: days });
                            }}
                          >
                            {day.label}
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Pilih hari-hari untuk posting mingguan
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="time">Waktu Kirim (24 Jam)</Label>
                    <div className="flex gap-2 items-center">
                      <Select
                        value={formData.schedule_time.split(':')[0]}
                        onValueChange={(hour) => {
                          const minute = formData.schedule_time.split(':')[1] || '00';
                          setFormData({ ...formData, schedule_time: `${hour}:${minute}` });
                        }}
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: 24 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-lg font-medium">:</span>
                      <Select
                        value={formData.schedule_time.split(':')[1] || '00'}
                        onValueChange={(minute) => {
                          const hour = formData.schedule_time.split(':')[0];
                          setFormData({ ...formData, schedule_time: `${hour}:${minute}` });
                        }}
                      >
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {Array.from({ length: 60 }, (_, i) => (
                            <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                              {i.toString().padStart(2, '0')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timezone">Zona Waktu</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Jakarta">WIB - Jakarta (GMT+7)</SelectItem>
                        <SelectItem value="Asia/Makassar">WITA - Makassar (GMT+8)</SelectItem>
                        <SelectItem value="Asia/Jayapura">WIT - Jayapura (GMT+9)</SelectItem>
                        <SelectItem value="Asia/Singapore">Singapore (GMT+8)</SelectItem>
                        <SelectItem value="Asia/Kuala_Lumpur">Malaysia (GMT+8)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="random_delay"
                        checked={formData.random_delay}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, random_delay: checked })
                        }
                      />
                      <Label htmlFor="random_delay" className="cursor-pointer">
                        Acak waktu kirim
                      </Label>
                    </div>
                    {formData.random_delay && (
                      <div className="pl-8">
                        <Label htmlFor="delay_minutes" className="text-xs">
                          Random ±{formData.delay_minutes} menit
                        </Label>
                        <Input
                          id="delay_minutes"
                          type="number"
                          min="1"
                          max="60"
                          value={formData.delay_minutes}
                          onChange={(e) =>
                            setFormData({ ...formData, delay_minutes: parseInt(e.target.value) || 5 })
                          }
                          className="w-24 text-sm"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Waktu kirim akan diacak ±{formData.delay_minutes} menit dari jadwal
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_active: checked })
                      }
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">
                      Aktifkan jadwal ini
                    </Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="message">Pesan</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tulis pesan yang akan dikirim..."
                      rows={8}
                      required
                    />
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-2">
                        💡 Gunakan variabel untuk pesan dinamis:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li><code className="bg-muted px-1 rounded">(halo|hai|hi)</code> - Random pilihan text</li>
                        <li><code className="bg-muted px-1 rounded">{"{{"}nama{"}}"}  atau [[NAME]]</code> - Nama grup/kontak</li>
                        <li><code className="bg-muted px-1 rounded">{"{{"}waktu{"}}"}</code> - Waktu saat ini (contoh: 09:30)</li>
                        <li><code className="bg-muted px-1 rounded">{"{{"}tanggal{"}}"}</code> - Tanggal saat ini (contoh: 31/10/2025)</li>
                        <li><code className="bg-muted px-1 rounded">{"{{"}hari{"}}"}</code> - Hari saat ini (contoh: Senin)</li>
                      </ul>
                    </div>
                  </div>

                  {/* Media Upload */}
                  <div className="space-y-2">
                    <Label htmlFor="media_url">Media (Opsional)</Label>
                    <Input
                      id="media_url"
                      type="url"
                      value={formData.media_url}
                      onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                    />
                    <p className="text-xs text-muted-foreground">
                      URL gambar/video yang akan dikirim bersama pesan (format: JPG, PNG, MP4, dll)
                    </p>
                    {formData.media_url && (
                      <div className="p-2 border rounded-lg bg-muted/30">
                        <p className="text-xs text-muted-foreground mb-2">Preview Media:</p>
                        {formData.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img
                            src={formData.media_url}
                            alt="Media preview"
                            className="max-w-full h-auto max-h-40 rounded object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : formData.media_url.match(/\.(mp4|mov|avi)$/i) ? (
                          <video
                            src={formData.media_url}
                            className="max-w-full h-auto max-h-40 rounded"
                            controls
                          />
                        ) : (
                          <p className="text-xs text-muted-foreground">📎 {formData.media_url}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Message Preview */}
                  {formData.message && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Preview Pesan:</Label>
                      <WhatsAppPreview
                        message={previewMessageVariables(formData.message)}
                        hasMedia={!!formData.media_url}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pilih Grup Target ({formData.target_groups.length} dipilih)
                  </Label>
                  {selectedDevice && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSyncGroups}
                      disabled={syncing}
                      className="transition-all duration-200"
                    >
                      {syncing ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Sync Grup
                        </>
                      )}
                    </Button>
                  )}
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-4 border rounded-lg bg-muted/30">
                  {!selectedDevice ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Pilih device terlebih dahulu untuk melihat grup WhatsApp</p>
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="col-span-full text-center py-8 space-y-3">
                      <Users className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        Tidak ada grup WhatsApp di device ini
                      </p>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={handleSyncGroups}
                        disabled={syncing}
                        className="mx-auto"
                      >
                        {syncing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sedang Sync Grup...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync Grup WhatsApp Sekarang
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    groups.map((group) => (
                      <Card
                        key={group.id}
                        className={`cursor-pointer transition-all duration-300 ease-in-out hover:shadow-md hover:scale-105 ${
                          formData.target_groups.includes(group.id)
                            ? "border-primary bg-primary/5 shadow-sm"
                            : ""
                        }`}
                        onClick={() => handleToggleGroup(group.id)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {group.name || group.phone_number}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {group.phone_number}
                              </p>
                            </div>
                            {formData.target_groups.includes(group.id) && (
                              <Badge variant="default" className="text-xs shrink-0">
                                ✓
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={formData.target_groups.length === 0}
              >
                {editingSchedule ? (
                  <><Edit className="w-4 h-4 mr-2" />Perbarui Jadwal</>
                ) : (
                  <><Calendar className="w-4 h-4 mr-2" />Buat Jadwal Auto Post</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Existing Schedules */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Jadwal Aktif</h2>
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  Belum ada jadwal auto post. Buat yang pertama!
                </p>
              </CardContent>
            </Card>
          ) : (
            schedules.map((schedule) => (
              <Card key={schedule.id} className="transition-all duration-300 ease-in-out hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{schedule.name}</CardTitle>
                        <Badge variant={schedule.is_active ? "default" : "secondary"} className="text-xs">
                          {schedule.is_active ? "🟢 Aktif" : "⚪ Nonaktif"}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <CardDescription className="flex items-center gap-1.5 text-xs">
                          <Clock className="w-3 h-3" />
                          {schedule.frequency === 'daily' && 'Setiap hari'}
                          {schedule.frequency === 'weekly' && `Setiap ${getDayNames(schedule.selected_days || [0,1,2,3,4,5,6])}`}
                          {schedule.frequency === 'monthly' && 'Setiap bulan'}
                          {' '}pukul {schedule.schedule_time}
                          {schedule.random_delay && ` ±${schedule.delay_minutes}m`}
                        </CardDescription>

                        <CardDescription className="flex items-center gap-1.5 text-xs">
                          <Globe className="w-3 h-3" />
                          {schedule.timezone || 'Asia/Jakarta'}
                        </CardDescription>

                        {(schedule.send_count || 0) > 0 && (
                          <CardDescription className="flex items-center gap-1.5 text-xs">
                            <BarChart3 className="w-3 h-3" />
                            Terkirim: {schedule.send_count || 0}
                            {(schedule.failed_count || 0) > 0 && ` • Gagal: ${schedule.failed_count}`}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Media preview */}
                    {schedule.media_url && (
                      <div className="relative">
                        {schedule.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img
                            src={schedule.media_url}
                            alt="Media"
                            className="w-full max-h-48 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="p-3 bg-muted/50 rounded-lg flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{schedule.media_url}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Message */}
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">{schedule.message}</p>
                    </div>

                    {/* Info row */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {schedule.target_groups.length} grup
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatNextSendTime(schedule)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditSchedule(schedule)}
                        title="Edit jadwal"
                      >
                        <Edit className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDuplicateSchedule(schedule)}
                        title="Duplikasi jadwal"
                      >
                        <Copy className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Duplikasi</span>
                      </Button>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewLogs(schedule.id)}
                            title="Lihat riwayat"
                          >
                            <History className="w-3.5 h-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Riwayat</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Riwayat Pengiriman: {schedule.name}</DialogTitle>
                            <DialogDescription>
                              Log pengiriman pesan auto post
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-2">
                            {logs.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-8">
                                Belum ada riwayat pengiriman
                              </p>
                            ) : (
                              logs.map((log) => (
                                <div key={log.id} className="p-3 border rounded-lg space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">{log.group_name}</span>
                                    <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-xs">
                                      {log.status === 'sent' ? '✅ Terkirim' : '❌ Gagal'}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(log.sent_at).toLocaleString('id-ID')}
                                  </p>
                                  {log.error_message && (
                                    <p className="text-xs text-destructive">{log.error_message}</p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      <div className="flex-1" />

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(schedule.id, schedule.is_active)}
                        title={schedule.is_active ? "Nonaktifkan" : "Aktifkan"}
                      >
                        {schedule.is_active ? (
                          <PowerOff className="w-3.5 h-3.5 sm:mr-1 text-orange-500" />
                        ) : (
                          <Power className="w-3.5 h-3.5 sm:mr-1 text-green-500" />
                        )}
                        <span className="hidden sm:inline">
                          {schedule.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </span>
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteSchedule(schedule.id, schedule.name)}
                        title="Hapus jadwal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline ml-1">Hapus</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
