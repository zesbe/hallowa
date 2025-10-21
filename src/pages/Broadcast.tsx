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
import { Plus, Send, Clock, CheckCircle2, XCircle, X, Users, RefreshCw, Copy, Calendar, FileText, Download, Eye, Edit, Trash2, MoreVertical, Loader2, PlayCircle, Upload, Image as ImageIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

export const Broadcast = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manualNumbers, setManualNumbers] = useState<string[]>([]);
  const [currentNumber, setCurrentNumber] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    device_id: "",
    target_contacts: [] as string[],
    media_url: null as string | null,
  });

  useEffect(() => {
    fetchData();
    
    // Check for quick message from template
    const quickMessage = sessionStorage.getItem("quick-message");
    if (quickMessage) {
      setFormData((prev) => ({ ...prev, message: quickMessage }));
      setDialogOpen(true);
      sessionStorage.removeItem("quick-message");
    }

    // Subscribe to real-time broadcast updates
    const channel = supabase
      .channel('broadcasts-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'broadcasts'
        },
        (payload) => {
          console.log('Broadcast update:', payload);
          fetchData();
          
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const broadcastName = payload.new?.name;
          
          if (oldStatus !== newStatus && broadcastName) {
            if (newStatus === 'processing' && oldStatus === 'draft') {
              toast.info(`📤 ${broadcastName}`, {
                description: 'Broadcast dimulai, pesan sedang dikirim...'
              });
            } else if (newStatus === 'completed') {
              toast.success(`✅ ${broadcastName} Selesai!`, {
                description: `Terkirim: ${payload.new?.sent_count || 0}, Gagal: ${payload.new?.failed_count || 0}`
              });
            } else if (newStatus === 'failed') {
              toast.error(`❌ ${broadcastName} Gagal`, {
                description: 'Coba kirim ulang atau periksa koneksi device'
              });
            } else if (newStatus === 'cancelled') {
              toast.warning(`⚠️ ${broadcastName} Dibatalkan`, {
                description: 'Pengiriman broadcast telah dibatalkan'
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
    const { data: broadcastData } = await supabase
        .from("broadcasts")
        .select("*")
        .is("scheduled_at", null)
        .order("created_at", { ascending: false });

      const { data: deviceData } = await supabase
        .from("devices")
        .select("*")
        .eq("status", "connected");

      const { data: contactData } = await supabase
        .from("contacts")
        .select("*")
        .order("name");

      setBroadcasts(broadcastData || []);
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

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("broadcasts").insert({
        user_id: user.id,
        device_id: formData.device_id,
        name: formData.name,
        message: formData.message,
        media_url: formData.media_url,
        target_contacts: allTargets,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Broadcast berhasil dibuat");
      setDialogOpen(false);
      setFormData({ name: "", message: "", device_id: "", target_contacts: [], media_url: null });
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

    // Check file size (max 50MB)
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
      
      const { error: uploadError, data } = await supabase.storage
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

  const handleSendNow = async (broadcastId: string) => {
    setSendingId(broadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ status: "processing" })
        .eq("id", broadcastId);

      if (error) throw error;

      toast.success("Broadcast dimulai!", {
        description: "Pesan sedang dikirim ke semua kontak terpilih."
      });
      fetchData();
    } catch (error: any) {
      toast.error("Gagal mengirim broadcast: " + error.message);
    } finally {
      setSendingId(null);
    }
  };

  const handleRetry = async (broadcastId: string) => {
    setActionLoading(broadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ 
          status: "processing",
          sent_count: 0,
          failed_count: 0
        })
        .eq("id", broadcastId);

      if (error) throw error;

      toast.success("Broadcast diulang!", {
        description: "Mencoba mengirim ulang pesan."
      });
      fetchData();
    } catch (error: any) {
      toast.error("Gagal retry broadcast", {
        description: error.message
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (broadcastId: string) => {
    setActionLoading(broadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .update({ status: "cancelled" })
        .eq("id", broadcastId);

      if (error) throw error;

      toast.success("Broadcast dibatalkan");
      fetchData();
    } catch (error: any) {
      toast.error("Gagal membatalkan broadcast", {
        description: error.message
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDuplicate = async (broadcast: Broadcast) => {
    setActionLoading(broadcast.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Get full broadcast data
      const { data: fullBroadcast } = await supabase
        .from("broadcasts")
        .select("*")
        .eq("id", broadcast.id)
        .single();

      if (!fullBroadcast) throw new Error("Broadcast not found");

      const { error } = await supabase
        .from("broadcasts")
        .insert({
          user_id: user.id,
          device_id: fullBroadcast.device_id,
          name: `${broadcast.name} (Copy)`,
          message: fullBroadcast.message,
          media_url: fullBroadcast.media_url,
          target_contacts: fullBroadcast.target_contacts,
          status: "draft"
        });

      if (error) throw error;

      toast.success("Broadcast diduplikasi!", {
        description: "Salinan broadcast telah dibuat sebagai draft."
      });
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menduplikasi broadcast", {
        description: error.message
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedBroadcastId) return;
    
    setActionLoading(selectedBroadcastId);
    try {
      const { error } = await supabase
        .from("broadcasts")
        .delete()
        .eq("id", selectedBroadcastId);

      if (error) throw error;

      toast.success("Broadcast dihapus");
      fetchData();
    } catch (error: any) {
      toast.error("Gagal menghapus broadcast", {
        description: error.message
      });
    } finally {
      setActionLoading(null);
      setDeleteDialogOpen(false);
      setSelectedBroadcastId(null);
    }
  };

  const handleExport = async (broadcast: Broadcast) => {
    const { data: fullBroadcast } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("id", broadcast.id)
      .single();

    if (!fullBroadcast) return;

    const targetContacts = Array.isArray(fullBroadcast.target_contacts) ? fullBroadcast.target_contacts : [];

    const data = {
      name: broadcast.name,
      message: fullBroadcast.message,
      status: broadcast.status,
      sent_count: broadcast.sent_count,
      failed_count: broadcast.failed_count,
      total_contacts: targetContacts.length,
      created_at: broadcast.created_at,
      target_contacts: targetContacts
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `broadcast-${broadcast.name.replace(/\s+/g, "-")}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Data broadcast diexport");
  };

  const handleViewLogs = (broadcast: Broadcast) => {
    toast.info("Fitur View Logs", {
      description: `Menampilkan log untuk: ${broadcast.name}`
    });
  };

  const handlePreview = (broadcast: Broadcast) => {
    toast.info("Preview Broadcast", {
      description: broadcast.message.substring(0, 100) + (broadcast.message.length > 100 ? "..." : "")
    });
  };

  const confirmDelete = (broadcastId: string) => {
    setSelectedBroadcastId(broadcastId);
    setDeleteDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success text-success-foreground";
      case "processing":
        return "bg-warning text-warning-foreground";
      case "failed":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return CheckCircle2;
      case "processing":
        return Clock;
      case "failed":
        return XCircle;
      default:
        return Clock;
    }
  };

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Broadcast Pesan</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Kirim pesan langsung ke banyak kontak sekaligus
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary text-white w-full">
                <Plus className="w-4 h-4 mr-2" />
                Buat Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Buat Broadcast Baru</DialogTitle>
                <DialogDescription>
                  Kirim pesan ke multiple kontak sekaligus
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Campaign</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Promo Bulan Ini"
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
                <Button type="submit" className="w-full">
                  <Send className="w-4 h-4 mr-2" />
                  Buat Broadcast
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {broadcasts.filter(b => !b.scheduled_at).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Send className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Belum ada broadcast. Buat broadcast pertama Anda!
                </p>
              </CardContent>
            </Card>
          ) : (
            broadcasts.filter(b => !b.scheduled_at).map((broadcast) => {
            const StatusIcon = getStatusIcon(broadcast.status);
            return (
              <Card key={broadcast.id}>
                 <CardHeader>
                   <div className="flex items-start justify-between gap-3">
                     <div className="flex-1 min-w-0">
                       <CardTitle className="truncate">{broadcast.name}</CardTitle>
                       <CardDescription className="mt-2 line-clamp-2">
                         {broadcast.message}
                       </CardDescription>
                       <div className="flex flex-wrap gap-2 mt-2">
                          {broadcast.media_url && (
                            <Badge variant="outline" className="text-xs">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              Media terlampir
                            </Badge>
                          )}
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                       <Badge className={getStatusColor(broadcast.status)} variant="secondary">
                         <StatusIcon className="w-3 h-3 mr-1" />
                         {broadcast.status}
                       </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            disabled={actionLoading === broadcast.id}
                            className="h-8 w-8 p-0"
                          >
                            {actionLoading === broadcast.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handlePreview(broadcast)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(broadcast)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplikasi
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewLogs(broadcast)}>
                            <FileText className="mr-2 h-4 w-4" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(broadcast)}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Data
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => confirmDelete(broadcast.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-xs md:text-sm">
                    <div className="text-center p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-[10px] md:text-xs mb-1">Terkirim</p>
                      <p className="text-base md:text-lg font-semibold text-success">{broadcast.sent_count}</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-[10px] md:text-xs mb-1">Gagal</p>
                      <p className="text-base md:text-lg font-semibold text-destructive">{broadcast.failed_count}</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-md">
                      <p className="text-muted-foreground text-[10px] md:text-xs mb-1">Total</p>
                      <p className="text-base md:text-lg font-semibold">{broadcast.sent_count + broadcast.failed_count}</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {broadcast.status === "draft" && (
                      <Button 
                        className="flex-1" 
                        size="lg"
                        onClick={() => handleSendNow(broadcast.id)}
                        disabled={sendingId === broadcast.id}
                      >
                        {sendingId === broadcast.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Mengirim...
                          </>
                        ) : (
                          <>
                            <PlayCircle className="w-4 h-4 mr-2" />
                            Kirim Sekarang
                          </>
                        )}
                      </Button>
                    )}
                    
                    {broadcast.status === "processing" && (
                      <>
                        <Button className="flex-1" variant="secondary" size="lg" disabled>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sedang Mengirim...
                        </Button>
                        <Button 
                          size="lg"
                          variant="destructive"
                          onClick={() => handleCancel(broadcast.id)}
                          disabled={actionLoading === broadcast.id}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    
                    {broadcast.status === "failed" && (
                      <Button 
                        className="flex-1" 
                        size="lg"
                        variant="outline"
                        onClick={() => handleRetry(broadcast.id)}
                        disabled={actionLoading === broadcast.id}
                      >
                        {actionLoading === broadcast.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Coba Lagi
                      </Button>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Dibuat: {new Date(broadcast.created_at).toLocaleDateString()} {new Date(broadcast.created_at).toLocaleTimeString()}
                  </p>
                </CardContent>
              </Card>
            );
          })
        )}
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Broadcast?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Broadcast akan dihapus permanen dari sistem.
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
};

export default Broadcast;
