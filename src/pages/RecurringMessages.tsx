import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Calendar, 
  Clock, 
  Repeat, 
  Pause, 
  Play, 
  Edit, 
  Trash2, 
  Users,
  CheckCircle2,
  XCircle,
  Timer,
  TrendingUp,
  CalendarClock,
  HelpCircle,
  Zap,
  BarChart3,
  Shield
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRecurringMessages } from "@/hooks/useRecurringMessages";
import { useDevices } from "@/hooks/useDevices";
import { useContacts } from "@/hooks/useContacts";
import { ContactSelectorEnhanced } from "@/components/ContactSelectorEnhanced";
import { format, formatDistanceToNow } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DAYS_OF_WEEK = [
  { value: 0, label: 'Min' },
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
];

const FREQUENCIES = [
  { value: 'daily', label: 'Harian', icon: Calendar },
  { value: 'weekly', label: 'Mingguan', icon: CalendarClock },
  { value: 'monthly', label: 'Bulanan', icon: Calendar },
  { value: 'custom', label: 'Custom', icon: Timer },
];

export default function RecurringMessages() {
  const { 
    recurringMessages, 
    isLoading,
    createRecurringMessage,
    updateRecurringMessage,
    deleteRecurringMessage,
    toggleActive,
    isCreating
  } = useRecurringMessages();
  
  const { devices } = useDevices();
  const { contacts } = useContacts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [currentNumber, setCurrentNumber] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    message: "",
    media_url: "",
    device_id: "",
    frequency: "daily" as 'daily' | 'weekly' | 'monthly' | 'custom',
    interval_value: 1,
    days_of_week: [1, 2, 3, 4, 5] as number[],
    day_of_month: 1,
    time_of_day: "09:00",
    timezone: "Asia/Jakarta",
    start_date: new Date().toISOString().split('T')[0],
    end_date: "",
    max_executions: undefined as number | undefined,
    delay_seconds: 5,
    randomize_delay: false,
    batch_size: 50,
    delay_type: "auto" as 'auto' | 'manual' | 'adaptive',
    pause_between_batches: 60,
  });

  const connectedDevices = devices.filter(d => d.status === 'connected');

  useEffect(() => {
    if (connectedDevices.length > 0 && !formData.device_id) {
      setFormData(prev => ({ ...prev, device_id: connectedDevices[0].id }));
    }
  }, [connectedDevices]);

  const resetForm = () => {
    setFormData({
      name: "",
      message: "",
      media_url: "",
      device_id: connectedDevices[0]?.id || "",
      frequency: "daily",
      interval_value: 1,
      days_of_week: [1, 2, 3, 4, 5],
      day_of_month: 1,
      time_of_day: "09:00",
      timezone: "Asia/Jakarta",
      start_date: new Date().toISOString().split('T')[0],
      end_date: "",
      max_executions: undefined,
      delay_seconds: 5,
      randomize_delay: false,
      batch_size: 50,
      delay_type: "auto",
      pause_between_batches: 60,
    });
    setSelectedContacts([]);
    setManualNumbers([]);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const allTargets = [...selectedContacts, ...manualNumbers];
    if (allTargets.length === 0) {
      toast.error("Pilih minimal 1 kontak atau nomor");
      return;
    }

    if (!formData.device_id) {
      toast.error("Pilih device yang terkoneksi");
      return;
    }

    try {
      const messageData = {
        ...formData,
        target_contacts: allTargets,
        max_executions: formData.max_executions || null,
        end_date: formData.end_date || null,
      };

      if (editingId) {
        await updateRecurringMessage({ id: editingId, updates: messageData });
      } else {
        await createRecurringMessage(messageData);
      }

      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving recurring message:', error);
    }
  };

  const handleEdit = (message: any) => {
    setEditingId(message.id);
    setFormData({
      name: message.name,
      message: message.message,
      media_url: message.media_url || "",
      device_id: message.device_id,
      frequency: message.frequency,
      interval_value: message.interval_value,
      days_of_week: message.days_of_week || [1, 2, 3, 4, 5],
      day_of_month: message.day_of_month || 1,
      time_of_day: message.time_of_day,
      timezone: message.timezone,
      start_date: message.start_date,
      end_date: message.end_date || "",
      max_executions: message.max_executions || undefined,
      delay_seconds: message.delay_seconds,
      randomize_delay: message.randomize_delay,
      batch_size: message.batch_size,
      delay_type: message.delay_type || "auto",
      pause_between_batches: message.pause_between_batches || 60,
    });
    setSelectedContacts(message.target_contacts || []);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus recurring message ini?')) {
      await deleteRecurringMessage(id);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const addManualNumber = () => {
    if (currentNumber && !manualNumbers.includes(currentNumber)) {
      setManualNumbers([...manualNumbers, currentNumber]);
      setCurrentNumber("");
    }
  };

  const getStatusColor = (message: any) => {
    if (!message.is_active) return 'secondary';
    if (message.end_date && new Date(message.end_date) < new Date()) return 'secondary';
    if (message.max_executions && message.total_sent >= message.max_executions) return 'secondary';
    return 'default';
  };

  const getFrequencyLabel = (frequency: string, intervalValue: number) => {
    switch (frequency) {
      case 'daily':
        return intervalValue === 1 ? 'Setiap Hari' : `Setiap ${intervalValue} Hari`;
      case 'weekly':
        return intervalValue === 1 ? 'Setiap Minggu' : `Setiap ${intervalValue} Minggu`;
      case 'monthly':
        return intervalValue === 1 ? 'Setiap Bulan' : `Setiap ${intervalValue} Bulan`;
      case 'custom':
        return `Setiap ${intervalValue} Hari`;
      default:
        return frequency;
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Pesan Berulang
            </h1>
            <p className="text-muted-foreground mt-1">
              Kirim pesan otomatis secara terjadwal dan berulang
            </p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-lg">
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Buat Recurring</span>
                <span className="sm:hidden">Buat</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? 'Edit Recurring Message' : 'Buat Recurring Message Baru'}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <Label>Nama Campaign *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Misal: Promo Harian, Newsletter Mingguan"
                      required
                    />
                  </div>

                  <div>
                    <Label>Pilih Device *</Label>
                    <Select 
                      value={formData.device_id} 
                      onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih device" />
                      </SelectTrigger>
                      <SelectContent>
                        {connectedDevices.map((device) => (
                          <SelectItem key={device.id} value={device.id}>
                            {device.device_name} - {device.phone_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Pesan *</Label>
                    <Textarea
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tulis pesan yang akan dikirim..."
                      rows={4}
                      required
                      className="resize-none"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-2">
                      Media URL (Opsional)
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="font-semibold mb-1">Cara menggunakan Media URL:</p>
                            <ol className="text-xs space-y-1 list-decimal list-inside">
                              <li>Upload gambar ke hosting (Google Drive, Imgur, dll)</li>
                              <li>Pastikan link dapat diakses publik (bukan private)</li>
                              <li>Copy direct link gambar (harus berakhiran .jpg, .png, atau .gif)</li>
                              <li>Paste link ke field ini</li>
                            </ol>
                            <p className="text-xs text-muted-foreground mt-2">
                              <strong>Format:</strong> jpg, png, gif, mp4<br />
                              <strong>Max size:</strong> 50MB
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Input
                      value={formData.media_url}
                      onChange={(e) => setFormData({ ...formData, media_url: e.target.value })}
                      placeholder="https://example.com/image.jpg atau https://i.imgur.com/xxx.png"
                      type="url"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      💡 Tip: Gambar akan dikirim bersamaan dengan pesan teks
                    </p>
                  </div>
                </div>

                {/* Schedule Settings */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Pengaturan Jadwal
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Frekuensi *</Label>
                      <Select 
                        value={formData.frequency} 
                        onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FREQUENCIES.map((freq) => (
                            <SelectItem key={freq.value} value={freq.value}>
                              {freq.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.frequency === 'custom' && (
                      <div>
                        <Label>Interval (Hari)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={formData.interval_value}
                          onChange={(e) => setFormData({ ...formData, interval_value: parseInt(e.target.value) })}
                        />
                      </div>
                    )}

                    {formData.frequency === 'weekly' && (
                      <div className="md:col-span-2">
                        <Label>Pilih Hari *</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {DAYS_OF_WEEK.map((day) => (
                            <Button
                              key={day.value}
                              type="button"
                              variant={formData.days_of_week.includes(day.value) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleDayOfWeek(day.value)}
                              className="w-12"
                            >
                              {day.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {formData.frequency === 'monthly' && (
                      <div>
                        <Label>Tanggal</Label>
                        <Input
                          type="number"
                          min="1"
                          max="31"
                          value={formData.day_of_month}
                          onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                        />
                      </div>
                    )}

                    <div>
                      <Label>Waktu Kirim *</Label>
                      <Input
                        type="time"
                        value={formData.time_of_day}
                        onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Mulai Dari *</Label>
                      <Input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <Label>Berakhir Pada (Opsional)</Label>
                      <Input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Max Eksekusi (Opsional)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Unlimited"
                        value={formData.max_executions || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          max_executions: e.target.value ? parseInt(e.target.value) : undefined 
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Safety Settings */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">⚡ Pengaturan Keamanan</Label>
                    <Badge variant="outline" className="text-xs">Anti-Banned</Badge>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delay-type">Mode Pengiriman</Label>
                    <Select
                      value={formData.delay_type}
                      onValueChange={(value: any) => setFormData({ ...formData, delay_type: value })}
                    >
                      <SelectTrigger id="delay-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-green-500" />
                            <div>
                              <div className="font-semibold">Auto (Direkomendasikan)</div>
                              <div className="text-xs text-muted-foreground">
                                Delay otomatis disesuaikan dengan jumlah kontak
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="adaptive">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-500" />
                            <div>
                              <div className="font-semibold">Adaptive</div>
                              <div className="text-xs text-muted-foreground">
                                Menyesuaikan dengan kecepatan pengiriman
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                        <SelectItem value="manual">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-orange-500" />
                            <div>
                              <div className="font-semibold">Manual</div>
                              <div className="text-xs text-muted-foreground">
                                Atur delay sendiri (hati-hati)
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.delay_type === 'manual' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="delay">Delay Antar Pesan</Label>
                        <Badge variant="secondary">{formData.delay_seconds}s</Badge>
                      </div>
                      <Input
                        id="delay"
                        type="number"
                        min="1"
                        value={formData.delay_seconds}
                        onChange={(e) => setFormData({ ...formData, delay_seconds: Math.max(1, parseInt(e.target.value) || 1) })}
                        placeholder="Detik"
                      />
                      <p className="text-xs text-muted-foreground">
                        ⚠️ Delay terlalu pendek dapat menyebabkan banned. Minimal 3 detik direkomendasikan.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2">
                    <div>
                      <Label htmlFor="randomize">Randomize Delay</Label>
                      <p className="text-xs text-muted-foreground">
                        Variasi acak ±20% untuk keamanan
                      </p>
                    </div>
                    <Switch
                      id="randomize"
                      checked={formData.randomize_delay}
                      onCheckedChange={(checked) => setFormData({ ...formData, randomize_delay: checked })}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="batch-size">Ukuran Batch</Label>
                      <Badge variant="secondary">{formData.batch_size} pesan</Badge>
                    </div>
                    <Slider
                      id="batch-size"
                      min={5}
                      max={100}
                      step={5}
                      value={[formData.batch_size]}
                      onValueChange={(value) => setFormData({ ...formData, batch_size: value[0] })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Jumlah pesan sebelum jeda batch
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pause">Jeda Antar Batch</Label>
                      <Badge variant="secondary">{formData.pause_between_batches}s</Badge>
                    </div>
                    <Slider
                      id="pause"
                      min={30}
                      max={300}
                      step={10}
                      value={[formData.pause_between_batches]}
                      onValueChange={(value) => setFormData({ ...formData, pause_between_batches: value[0] })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Waktu jeda setelah mengirim 1 batch
                    </p>
                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Penerima
                  </h3>

                  <Tabs defaultValue="contacts">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="contacts">Dari Kontak</TabsTrigger>
                      <TabsTrigger value="manual">Input Manual</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="contacts" className="mt-4">
                      <ContactSelectorEnhanced
                        contacts={contacts}
                        selectedContacts={selectedContacts}
                        onToggleContact={(phone) => {
                          setSelectedContacts(prev =>
                            prev.includes(phone)
                              ? prev.filter(p => p !== phone)
                              : [...prev, phone]
                          );
                        }}
                        onSelectByTag={(tag) => {
                          const contactsWithTag = contacts.filter(c => c.tags?.includes(tag));
                          const phoneNumbers = contactsWithTag.map(c => c.phone_number);
                          setSelectedContacts(prev => {
                            const newSet = new Set([...prev, ...phoneNumbers]);
                            return Array.from(newSet);
                          });
                        }}
                        onSelectAll={(phoneNumbers) => {
                          setSelectedContacts(prev => {
                            const newSet = new Set([...prev, ...phoneNumbers]);
                            return Array.from(newSet);
                          });
                        }}
                        onClearAll={() => setSelectedContacts([])}
                      />
                    </TabsContent>

                    <TabsContent value="manual" className="mt-4">
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Input
                            placeholder="628123456789"
                            value={currentNumber}
                            onChange={(e) => setCurrentNumber(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addManualNumber())}
                          />
                          <Button type="button" onClick={addManualNumber}>
                            Tambah
                          </Button>
                        </div>
                        {manualNumbers.length > 0 && (
                          <div className="flex flex-wrap gap-2 p-3 border rounded-lg">
                            {manualNumbers.map((num) => (
                              <Badge key={num} variant="secondary" className="gap-2">
                                {num}
                                <button
                                  type="button"
                                  onClick={() => setManualNumbers(manualNumbers.filter(n => n !== num))}
                                  className="hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>

                  <div className="text-sm text-muted-foreground">
                    Total penerima: {selectedContacts.length + manualNumbers.length}
                  </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Menyimpan...' : (editingId ? 'Update' : 'Buat')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Repeat className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Recurring</p>
                <p className="text-2xl font-bold">{recurringMessages.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Play className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aktif</p>
                <p className="text-2xl font-bold">
                  {recurringMessages.filter(m => m.is_active).length}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Terkirim</p>
                <p className="text-2xl font-bold">
                  {recurringMessages.reduce((sum, m) => sum + m.total_sent, 0)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recurring Messages List */}
        <div className="space-y-4">
          {recurringMessages.length === 0 ? (
            <Card className="p-12">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Repeat className="w-12 h-12 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Belum Ada Recurring Message</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Buat recurring message pertama Anda untuk mengirim pesan otomatis secara terjadwal
                </p>
                <Button onClick={() => setDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Buat Recurring Message
                </Button>
              </div>
            </Card>
          ) : (
            recurringMessages.map((message) => (
              <Card key={message.id} className="p-4 md:p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${message.is_active ? 'bg-green-500/10' : 'bg-gray-500/10'}`}>
                        {message.is_active ? (
                          <Play className="w-5 h-5 text-green-500" />
                        ) : (
                          <Pause className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-lg font-semibold">{message.name}</h3>
                          <Badge variant={getStatusColor(message)}>
                            {message.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                          <Badge variant="outline">
                            {getFrequencyLabel(message.frequency, message.interval_value)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                          {message.message}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{message.time_of_day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{(message.target_contacts as any[])?.length || 0} penerima</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span>{message.total_sent} terkirim</span>
                      </div>
                      {message.total_failed > 0 && (
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span>{message.total_failed} gagal</span>
                        </div>
                      )}
                    </div>

                    {message.next_send_at && message.is_active && (
                      <div className="text-sm text-muted-foreground">
                        Kirim berikutnya: {formatDistanceToNow(new Date(message.next_send_at), { 
                          addSuffix: true,
                          locale: localeId 
                        })}
                      </div>
                    )}

                    {message.last_sent_at && (
                      <div className="text-xs text-muted-foreground">
                        Terakhir dikirim: {format(new Date(message.last_sent_at), 'dd MMM yyyy, HH:mm', { locale: localeId })}
                      </div>
                    )}
                  </div>

                  <div className="flex md:flex-col gap-2">
                    <Button
                      size="sm"
                      variant={message.is_active ? "outline" : "default"}
                      onClick={() => toggleActive({ id: message.id, is_active: !message.is_active })}
                      className="gap-2 flex-1 md:flex-none"
                    >
                      {message.is_active ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span className="hidden sm:inline">Jeda</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span className="hidden sm:inline">Aktifkan</span>
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(message)}
                      className="gap-2 flex-1 md:flex-none"
                    >
                      <Edit className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(message.id)}
                      className="gap-2 flex-1 md:flex-none"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Hapus</span>
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}