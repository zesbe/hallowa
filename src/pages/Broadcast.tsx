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
import { Plus, Send, Clock, CheckCircle2, XCircle, X, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Broadcast {
  id: string;
  name: string;
  message: string;
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
  const [formData, setFormData] = useState({
    name: "",
    message: "",
    device_id: "",
    target_contacts: [] as string[],
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
  }, []);

  const fetchData = async () => {
    try {
      const { data: broadcastData } = await supabase
        .from("broadcasts")
        .select("*")
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
        target_contacts: allTargets,
        status: "draft",
      });

      if (error) throw error;

      toast.success("Broadcast berhasil dibuat");
      setDialogOpen(false);
      setFormData({ name: "", message: "", device_id: "", target_contacts: [] });
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
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Broadcast</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Kirim pesan ke banyak kontak sekaligus
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
          {broadcasts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Send className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Belum ada broadcast. Buat broadcast pertama Anda!
                </p>
              </CardContent>
            </Card>
          ) : (
            broadcasts.map((broadcast) => {
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
                    </div>
                    <Badge className={getStatusColor(broadcast.status)} variant="secondary">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {broadcast.status}
                    </Badge>
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
                  {broadcast.status === "draft" && (
                    <Button className="w-full" size="lg">
                      <Send className="w-4 h-4 mr-2" />
                      Kirim Sekarang
                    </Button>
                  )}
                  {broadcast.status === "processing" && (
                    <Button className="w-full" variant="secondary" size="lg" disabled>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Sedang Mengirim...
                    </Button>
                  )}
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
    </Layout>
  );
};

export default Broadcast;
