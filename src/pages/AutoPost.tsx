import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Send, Clock, Users, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

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
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    target_groups: [] as string[],
    frequency: "daily" as 'daily' | 'weekly' | 'monthly',
    schedule_time: "09:00",
    is_active: true,
  });

  useEffect(() => {
    fetchGroups();
    fetchSchedules();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("is_group", true)
        .order("name");

      if (error) throw error;
      setGroups(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat grup");
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    // Placeholder - akan diimplementasi dengan table baru
    setSchedules([]);
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
      toast.error("Pilih minimal 1 grup");
      return;
    }

    toast.info("Fitur auto-post akan segera hadir! Database sedang disiapkan.");
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
                    <p className="text-xs text-muted-foreground">
                      Tips: Gunakan variabel [[NAMA]], {"{"}nama{"}"}, {"{"}waktu{"}"}, {"{"}tanggal{"}"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Pilih Grup Target ({formData.target_groups.length} dipilih)
                </Label>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-4 border rounded-lg bg-muted/30">
                  {groups.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      Tidak ada grup. Buat grup terlebih dahulu di halaman Kontak.
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
