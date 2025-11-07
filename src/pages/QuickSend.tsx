import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Send,
  Zap,
  Phone,
  MessageSquare,
  Image,
  FileText,
  Users,
  Trash2,
  Plus,
  Upload,
  Sparkles
} from "lucide-react";

interface Device {
  id: string;
  name: string;
  phone_number: string;
  status: string;
}

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  is_group: boolean;
}

interface Template {
  id: string;
  name: string;
  message: string;
}

interface Recipient {
  id: string;
  phone: string;
  name?: string;
}

export default function QuickSend() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [recipients, setRecipients] = useState<Recipient[]>([{ id: crypto.randomUUID(), phone: "" }]);
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);

  useEffect(() => {
    if (user) {
      fetchDevices();
      fetchContacts();
      fetchTemplates();
    }
  }, [user]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, name, phone_number, status")
        .eq("user_id", user?.id)
        .eq("status", "connected")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);

      // Auto-select first device if available
      if (data && data.length > 0 && !selectedDevice) {
        setSelectedDevice(data[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching devices:", error);
      toast.error("Gagal memuat device");
    }
  };

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, phone_number, name, is_group")
        .eq("user_id", user?.id)
        .order("name", { ascending: true })
        .limit(100);

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, message")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
    }
  };

  const addRecipient = () => {
    setRecipients([...recipients, { id: crypto.randomUUID(), phone: "" }]);
  };

  const removeRecipient = (id: string) => {
    if (recipients.length === 1) {
      toast.error("Minimal harus ada satu penerima");
      return;
    }
    setRecipients(recipients.filter(r => r.id !== id));
  };

  const updateRecipient = (id: string, phone: string) => {
    setRecipients(recipients.map(r => r.id === id ? { ...r, phone } : r));
  };

  const addContactAsRecipient = (contact: Contact) => {
    const exists = recipients.some(r => r.phone === contact.phone_number);
    if (exists) {
      toast.info("Kontak sudah ditambahkan");
      return;
    }

    setRecipients([
      ...recipients.filter(r => r.phone !== ""),
      { id: crypto.randomUUID(), phone: contact.phone_number, name: contact.name || undefined }
    ]);
    toast.success(`${contact.name || contact.phone_number} ditambahkan`);
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.message);
      toast.success("Template dimuat");
    }
  };

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 10MB");
      return;
    }

    setMediaFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview("");
  };

  const validateForm = () => {
    if (!selectedDevice) {
      toast.error("Pilih device terlebih dahulu");
      return false;
    }

    const validRecipients = recipients.filter(r => r.phone.trim() !== "");
    if (validRecipients.length === 0) {
      toast.error("Masukkan minimal satu nomor penerima");
      return false;
    }

    if (!message.trim() && !mediaFile) {
      toast.error("Masukkan pesan atau pilih media");
      return false;
    }

    return true;
  };

  const handleSend = async () => {
    if (!validateForm()) return;

    setSending(true);

    try {
      const validRecipients = recipients.filter(r => r.phone.trim() !== "");

      // Upload media if exists
      let mediaUrl = "";
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("media")
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("media")
          .getPublicUrl(fileName);

        mediaUrl = publicUrl;
      }

      // Determine message type
      let messageType = "text";
      if (mediaFile) {
        if (mediaFile.type.startsWith("image/")) messageType = "image";
        else if (mediaFile.type.startsWith("video/")) messageType = "video";
        else if (mediaFile.type.startsWith("audio/")) messageType = "audio";
        else messageType = "document";
      }

      // Send messages via Railway service
      const { data: deviceData } = await supabase
        .from("devices")
        .select("phone_number")
        .eq("id", selectedDevice)
        .single();

      if (!deviceData) throw new Error("Device tidak ditemukan");

      let successCount = 0;
      let failCount = 0;

      for (const recipient of validRecipients) {
        try {
          // Format phone number
          let formattedPhone = recipient.phone.replace(/\D/g, "");
          if (formattedPhone.startsWith("0")) {
            formattedPhone = "62" + formattedPhone.substring(1);
          }
          if (!formattedPhone.startsWith("62")) {
            formattedPhone = "62" + formattedPhone;
          }

          // Create message request
          const messageData: any = {
            device_id: selectedDevice,
            to: formattedPhone,
            message: message.trim(),
            type: messageType
          };

          if (mediaUrl) {
            messageData.media_url = mediaUrl;
          }

          // Insert to message_queue (will be processed by Railway service)
          const { error: queueError } = await supabase
            .from("message_queue")
            .insert(messageData);

          if (queueError) throw queueError;

          // Log to message_history
          await supabase.from("message_history").insert({
            user_id: user?.id,
            device_id: selectedDevice,
            recipient_phone: formattedPhone,
            recipient_name: recipient.name || null,
            message_type: messageType,
            message_content: message.trim(),
            media_url: mediaUrl || null,
            status: "pending",
            campaign_name: "Quick Send"
          });

          successCount++;

          // Small delay to avoid spam
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error: any) {
          console.error(`Failed to send to ${recipient.phone}:`, error);
          failCount++;

          // Log failure
          await supabase.from("message_history").insert({
            user_id: user?.id,
            device_id: selectedDevice,
            recipient_phone: recipient.phone,
            recipient_name: recipient.name || null,
            message_type: messageType,
            message_content: message.trim(),
            media_url: mediaUrl || null,
            status: "failed",
            error_message: error.message,
            campaign_name: "Quick Send"
          });
        }
      }

      // Show result
      if (successCount > 0) {
        toast.success(`✅ ${successCount} pesan berhasil dikirim!`);
      }
      if (failCount > 0) {
        toast.error(`❌ ${failCount} pesan gagal dikirim`);
      }

      // Reset form
      setMessage("");
      setSelectedTemplate("");
      setMediaFile(null);
      setMediaPreview("");
      setRecipients([{ id: crypto.randomUUID(), phone: "" }]);

    } catch (error: any) {
      console.error("Error sending messages:", error);
      toast.error("Gagal mengirim pesan: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Zap className="w-8 h-8 text-primary" />
          Kirim Cepat
        </h1>
        <p className="text-muted-foreground">
          Kirim pesan WhatsApp secara cepat ke satu atau beberapa kontak
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Pilih Device
              </CardTitle>
            </CardHeader>
            <CardContent>
              {devices.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-3">
                    Tidak ada device yang terhubung
                  </p>
                  <Button variant="outline" onClick={() => window.location.href = "/devices"}>
                    Hubungkan Device
                  </Button>
                </div>
              ) : (
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih device..." />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        <div className="flex items-center gap-2">
                          {device.name} ({device.phone_number})
                          <Badge variant="secondary" className="ml-2">
                            {device.status}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Penerima
              </CardTitle>
              <CardDescription>
                Masukkan nomor penerima (format: 628xxx atau 08xxx)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="flex items-center gap-2">
                  <Input
                    placeholder="Nomor WhatsApp (contoh: 6281234567890)"
                    value={recipient.phone}
                    onChange={(e) => updateRecipient(recipient.id, e.target.value)}
                  />
                  {recipient.name && (
                    <Badge variant="secondary">{recipient.name}</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRecipient(recipient.id)}
                    disabled={recipients.length === 1}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}

              <Button
                variant="outline"
                onClick={addRecipient}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tambah Penerima
              </Button>
            </CardContent>
          </Card>

          {/* Template Selection */}
          {templates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Template Cepat
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Message */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Pesan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Tulis pesan Anda di sini..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />

              <div className="text-xs text-muted-foreground">
                {message.length} karakter
              </div>
            </CardContent>
          </Card>

          {/* Media Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="w-5 h-5" />
                Media (Opsional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mediaPreview ? (
                <div className="space-y-3">
                  <div className="relative w-full max-w-xs mx-auto">
                    {mediaFile?.type.startsWith("image/") && (
                      <img
                        src={mediaPreview}
                        alt="Preview"
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                    {mediaFile?.type.startsWith("video/") && (
                      <video
                        src={mediaPreview}
                        controls
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                    {!mediaFile?.type.startsWith("image/") && !mediaFile?.type.startsWith("video/") && (
                      <div className="p-6 bg-muted rounded-lg text-center">
                        <FileText className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm">{mediaFile?.name}</p>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    onClick={removeMedia}
                    className="w-full text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus Media
                  </Button>
                </div>
              ) : (
                <div>
                  <Input
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleMediaChange}
                    className="hidden"
                    id="media-upload"
                  />
                  <Label htmlFor="media-upload">
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Klik untuk upload gambar, video, audio, atau dokumen
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Max 10MB
                      </p>
                    </div>
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sending || devices.length === 0}
            size="lg"
            className="w-full"
          >
            {sending ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Mengirim...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Kirim Sekarang
              </>
            )}
          </Button>
        </div>

        {/* Contact Picker */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Kontak Cepat
              </CardTitle>
              <CardDescription>
                Pilih dari kontak yang tersimpan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {contacts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Belum ada kontak tersimpan
                  </p>
                ) : (
                  contacts.map((contact) => (
                    <Button
                      key={contact.id}
                      variant="outline"
                      className="w-full justify-start text-left"
                      onClick={() => addContactAsRecipient(contact)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {contact.name || contact.phone_number}
                        </p>
                        {contact.name && (
                          <p className="text-xs text-muted-foreground truncate">
                            {contact.phone_number}
                          </p>
                        )}
                      </div>
                      {contact.is_group && (
                        <Badge variant="secondary" className="ml-2">
                          Grup
                        </Badge>
                      )}
                    </Button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
