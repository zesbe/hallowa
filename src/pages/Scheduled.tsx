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
import { Plus, Calendar, Clock, Send, XCircle, Edit, Trash2, CheckCircle2, Image as ImageIcon, Users, X, Upload, Loader2 } from "lucide-react";
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
import { useEffect, useState } from "react";
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
}

export default function Scheduled() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [currentNumber, setCurrentNumber] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    device_id: "",
    media_url: null as string | null,
    scheduled_at: "",
  });

  useEffect(() => {
    fetchData();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('scheduled-broadcasts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcasts'
        },
        () => {
          fetchData();
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
      
      setBroadcasts((broadcastData || []) as Broadcast[]);
      setDevices(deviceData || []);
      setContacts(contactData || []);
    } catch (error: any) {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
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

      const { error } = await supabase.from("broadcasts").insert({
        user_id: user.id,
        device_id: formData.device_id,
        name: formData.name,
        message: formData.message,
        media_url: formData.media_url,
        scheduled_at: formData.scheduled_at,
        target_contacts: allTargets,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Broadcast terjadwal berhasil dibuat");
      setCreateDialogOpen(false);
      setFormData({ name: "", message: "", device_id: "", media_url: null, scheduled_at: "" });
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

  const filteredContactList = contacts.filter(
    (c) =>
      c.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
      c.phone_number.includes(contactSearch)
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
    setNewScheduledTime(broadcast.scheduled_at?.slice(0, 16) || "");
    setEditDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedBroadcast || !newScheduledTime) return;

    setActionLoading(selectedBroadcast.id);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ scheduled_at: newScheduledTime })
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
    return new Date(dateString).toLocaleString('id-ID', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const BroadcastCard = ({ broadcast, showActions = true }: { broadcast: Broadcast; showActions?: boolean }) => (
    <Card key={broadcast.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg mb-1 truncate">{broadcast.name}</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge className={getStatusColor(broadcast.status)}>
                {getStatusText(broadcast.status)}
              </Badge>
              {broadcast.scheduled_at && (
                <Badge variant="outline" className="text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {formatDateTime(broadcast.scheduled_at)}
                </Badge>
              )}
            </div>
          </div>
          {showActions && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEditSchedule(broadcast)}
                disabled={actionLoading === broadcast.id}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => confirmDelete(broadcast)}
                disabled={actionLoading === broadcast.id}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <CardDescription className="line-clamp-2">{broadcast.message}</CardDescription>
        
        <div className="flex flex-wrap gap-2">
          {broadcast.media_url && (
            <Badge variant="outline" className="text-xs">
              <ImageIcon className="w-3 h-3 mr-1" />
              Media terlampir
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            {Array.isArray(broadcast.target_contacts) ? broadcast.target_contacts.length : 0} kontak
          </Badge>
        </div>

        {broadcast.status !== "draft" && (
          <div className="flex gap-4 text-sm pt-2 border-t">
            <div className="flex items-center gap-1 text-success">
              <CheckCircle2 className="w-4 h-4" />
              <span>{broadcast.sent_count || 0} terkirim</span>
            </div>
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="w-4 h-4" />
              <span>{broadcast.failed_count || 0} gagal</span>
            </div>
          </div>
        )}

        {showActions && broadcast.status === "draft" && (
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => handleSendNow(broadcast.id)}
              disabled={actionLoading === broadcast.id}
            >
              <Send className="w-3 h-3 mr-1" />
              Kirim Sekarang
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCancelSchedule(broadcast.id)}
              disabled={actionLoading === broadcast.id}
            >
              Batalkan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Jadwal Broadcast</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Buat dan kelola broadcast terjadwal
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white w-full">
                <Plus className="w-4 h-4 mr-2" />
                Buat Broadcast Terjadwal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Buat Broadcast Terjadwal</DialogTitle>
                <DialogDescription>
                  Atur jadwal pengiriman broadcast otomatis
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Campaign</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Promo Akhir Tahun"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device">Device</Label>
                  <Select
                    value={formData.device_id}
                    onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih device" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.device_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled">Jadwal Pengiriman</Label>
                  <Input
                    id="scheduled"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                    min={new Date().toISOString().slice(0, 16)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Pilih waktu untuk pengiriman otomatis
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Pesan</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tulis pesan broadcast..."
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">File Media (Opsional)</Label>
                  {formData.media_url ? (
                    <div className="flex items-center gap-2 p-3 border rounded-md">
                      <ImageIcon className="w-4 h-4 text-primary" />
                      <span className="text-sm flex-1 truncate">File terlampir</span>
                      <Button type="button" variant="ghost" size="sm" onClick={handleRemoveFile}>
                        <X className="w-4 h-4" />
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
                      <Label htmlFor="file" className="flex-1">
                        <div className="flex items-center justify-center gap-2 p-3 border-2 border-dashed rounded-md cursor-pointer hover:bg-accent transition-colors">
                          {uploadingFile ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span className="text-sm">
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
                  <Label>Penerima</Label>
                  <Tabs defaultValue="manual" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="manual">Input Manual</TabsTrigger>
                      <TabsTrigger value="contacts">Dari Kontak</TabsTrigger>
                    </TabsList>
                    <TabsContent value="manual" className="space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="628123456789"
                          value={currentNumber}
                          onChange={(e) => setCurrentNumber(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addManualNumber())}
                        />
                        <Button type="button" onClick={addManualNumber} size="sm">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      {manualNumbers.length > 0 && (
                        <ScrollArea className="h-32 border rounded-md p-2">
                          <div className="flex flex-wrap gap-2">
                            {manualNumbers.map((num) => (
                              <Badge key={num} variant="secondary" className="gap-1">
                                {num}
                                <X
                                  className="w-3 h-3 cursor-pointer"
                                  onClick={() => removeManualNumber(num)}
                                />
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                    <TabsContent value="contacts" className="space-y-3">
                      <Input
                        placeholder="Cari kontak..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                      <ScrollArea className="h-64 border rounded-md p-3">
                        <div className="space-y-2">
                          {filteredContactList.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex items-center gap-2 p-2 hover:bg-accent rounded-md cursor-pointer"
                              onClick={() => toggleContact(contact.phone_number)}
                            >
                              <Checkbox
                                checked={selectedContacts.includes(contact.phone_number)}
                                onCheckedChange={() => toggleContact(contact.phone_number)}
                              />
                              <div className="flex items-center gap-2 flex-1">
                                {contact.is_group ? (
                                  <Users className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <div className="w-4 h-4" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {contact.name || contact.phone_number}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {contact.phone_number}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                  <p className="text-xs text-muted-foreground">
                    Total: {manualNumbers.length + selectedContacts.length} penerima
                  </p>
                </div>

                <Button type="submit" className="w-full">
                  <Calendar className="w-4 h-4 mr-2" />
                  Jadwalkan Broadcast
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">
              <Calendar className="w-4 h-4 mr-2" />
              Akan Datang ({upcomingBroadcasts.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Riwayat ({pastBroadcasts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4 mt-6">
            {upcomingBroadcasts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
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
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Jadwal Broadcast</DialogTitle>
            <DialogDescription>
              Ubah waktu pengiriman broadcast: {selectedBroadcast?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-schedule">Jadwal Baru</Label>
              <Input
                id="new-schedule"
                type="datetime-local"
                value={newScheduledTime}
                onChange={(e) => setNewScheduledTime(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setEditDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              className="flex-1"
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
    </Layout>
  );
}