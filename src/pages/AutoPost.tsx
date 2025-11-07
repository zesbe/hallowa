import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Clock, Users, Calendar, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { WhatsAppPreview } from "@/components/WhatsAppPreview";
import { previewMessageVariables } from "@/utils/messageVariables";

interface AutoPostSchedule {
  id: string;
  name: string;
  message: string;
  media_url?: string;
  target_groups: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  schedule_time: string;
  is_active: boolean;
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
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    target_groups: [] as string[],
    frequency: "daily" as 'daily' | 'weekly' | 'monthly',
    schedule_time: "09:00",
    is_active: true,
  });

  useEffect(() => {
    fetchDevices();
    fetchSchedules();
  }, []);

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
      setDevices(data || []);
      
      // Auto-select first device if available
      if (data && data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].id);
      }
    } catch (error: any) {
      toast.error("Gagal memuat device");
    } finally {
      setLoading(false);
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
      setGroups(data || []);
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
      
      // Transform data to match interface
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        target_groups: Array.isArray(item.target_groups) 
          ? item.target_groups 
          : []
      }));
      
      setSchedules(transformedData);
    } catch (error: any) {
      toast.error("Gagal memuat jadwal");
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
          target_groups: formData.target_groups,
          frequency: formData.frequency,
          schedule_time: formData.schedule_time,
          is_active: formData.is_active,
        });

      if (error) throw error;

      toast.success("Jadwal auto post berhasil dibuat!");
      setFormData({
        name: "",
        message: "",
        target_groups: [],
        frequency: "daily",
        schedule_time: "09:00",
        is_active: true,
      });
      fetchSchedules();
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat jadwal");
    }
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

        {/* Create Schedule Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Buat Jadwal Auto Post Baru
            </CardTitle>
            <CardDescription>
              Atur pesan yang akan dikirim otomatis ke grup-grup WhatsApp
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateSchedule} className="space-y-6">
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

                  <div className="space-y-2">
                    <Label htmlFor="time">Waktu Kirim</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.schedule_time}
                      onChange={(e) => setFormData({ ...formData, schedule_time: e.target.value })}
                      required
                    />
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

                  {/* Message Preview */}
                  {formData.message && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Preview Pesan:</Label>
                      <WhatsAppPreview 
                        message={previewMessageVariables(formData.message)}
                        hasMedia={false}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Pilih Grup Target ({formData.target_groups.length} dipilih)
                </Label>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-4 border rounded-lg bg-muted/30">
                  {!selectedDevice ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Pilih device terlebih dahulu untuk melihat grup WhatsApp
                    </div>
                  ) : groups.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Tidak ada grup WhatsApp di device ini. Sync kontak terlebih dahulu.
                    </div>
                  ) : (
                    groups.map((group) => (
                      <Card
                        key={group.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          formData.target_groups.includes(group.id)
                            ? "border-primary bg-primary/5"
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
                <Calendar className="w-4 h-4 mr-2" />
                Buat Jadwal Auto Post
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
              <Card key={schedule.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{schedule.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {schedule.frequency === 'daily' && 'Setiap hari'}
                        {schedule.frequency === 'weekly' && 'Setiap minggu'}
                        {schedule.frequency === 'monthly' && 'Setiap bulan'}
                        {' '}pukul {schedule.schedule_time}
                      </CardDescription>
                    </div>
                    <Badge variant={schedule.is_active ? "default" : "secondary"}>
                      {schedule.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm">{schedule.message}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {schedule.target_groups.length} grup
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
