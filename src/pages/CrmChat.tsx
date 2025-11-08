import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Search, Send, Phone, MoreVertical, Filter, Archive,
  Tag, Star, StickyNote, Zap, Image as ImageIcon,
  FileText, User, MessageSquare, Clock, Check, CheckCheck,
  X, Plus, Edit, Trash2, AlertCircle, Info
} from "lucide-react";
import { useState, useEffect, useRef, startTransition, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Real database schema interfaces
interface Contact {
  id: string;
  contact_jid: string;
  contact_name: string;
  contact_phone: string;
  last_message_preview?: string;
  last_message_time?: string;
  unread_count?: number;
  is_starred?: boolean;
  is_archived?: boolean;
  label?: string;
  notes?: string;
  created_at?: string;
  device_id: string;
  user_id: string;
}

interface Message {
  id: string;
  message_content: string;
  from_me: boolean;
  timestamp: string;
  status?: "sent" | "delivered" | "read" | "failed" | "pending";
  media_url?: string;
  message_type?: string;
  caption?: string;
  conversation_id: string;
  contact_jid: string;
}

interface QuickReply {
  id: string;
  name: string;
  message: string;
}

const CHAT_LABELS = [
  { value: "lead", label: "Lead", color: "bg-blue-500" },
  { value: "customer", label: "Customer", color: "bg-green-500" },
  { value: "support", label: "Support", color: "bg-orange-500" },
  { value: "vip", label: "VIP", color: "bg-purple-500" },
  { value: "follow-up", label: "Follow Up", color: "bg-yellow-500" },
];

export const CrmChat = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatFilter, setChatFilter] = useState<"all" | "unread" | "starred" | "archived">("all");
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [contactNotes, setContactNotes] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([
    { id: "1", name: "Greeting", message: "Halo! Ada yang bisa saya bantu?" },
    { id: "2", name: "Terima Kasih", message: "Terima kasih sudah menghubungi kami!" },
    { id: "3", name: "Follow Up", message: "Halo, saya ingin follow up pesanan Anda." },
  ]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [newQuickReply, setNewQuickReply] = useState({ name: "", message: "" });
  const [editingQuickReply, setEditingQuickReply] = useState<QuickReply | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      // Use startTransition to avoid blocking UI
      startTransition(() => {
        fetchContacts();
      });
    }
  }, [selectedDevice]);

  useEffect(() => {
    if (selectedContact) {
      // Use startTransition for non-critical updates
      startTransition(() => {
        fetchMessages(selectedContact.id);
      });
      setContactNotes(selectedContact.notes || "");
    } else {
      setMessages([]);
    }
  }, [selectedContact]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!selectedDevice) return;

    const channel = supabase
      .channel('crm-conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'whatsapp_conversations',
        filter: `device_id=eq.${selectedDevice}`
      }, async (payload) => {
        console.log('📱 Conversation update:', payload);
        // Refresh conversations list when any conversation changes
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("whatsapp_conversations")
          .select("*")
          .eq("user_id", user.id)
          .eq("device_id", selectedDevice)
          .order("updated_at", { ascending: false })
          .limit(100);

        if (data) {
          startTransition(() => {
            setContacts(data);
          });
        }
      })
      .subscribe();

    console.log('✅ Subscribed to conversations updates');

    return () => {
      console.log('🔌 Unsubscribed from conversations');
      channel.unsubscribe();
    };
  }, [selectedDevice]);

  // Realtime subscription for messages in selected conversation
  useEffect(() => {
    if (!selectedContact) return;

    const channel = supabase
      .channel(`crm-messages-${selectedContact.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selectedContact.id}`
      }, (payload) => {
        console.log('💬 New message received:', payload);
        // Add new message to messages list
        setMessages(prev => [...prev, payload.new as Message]);
        scrollToBottom();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'whatsapp_messages',
        filter: `conversation_id=eq.${selectedContact.id}`
      }, (payload) => {
        console.log('📝 Message status updated:', payload);
        // Update message status (delivered, read, etc)
        setMessages(prev => prev.map(msg =>
          msg.id === payload.new.id ? payload.new as Message : msg
        ));
      })
      .subscribe();

    console.log('✅ Subscribed to messages for conversation:', selectedContact.contact_name);

    return () => {
      console.log('🔌 Unsubscribed from messages');
      channel.unsubscribe();
    };
  }, [selectedContact]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchDevices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "connected");

      if (error) throw error;
      setDevices(data || []);

      if (data && data.length > 0) {
        setSelectedDevice(data[0].id);
      }
    } catch (error: any) {
      toast.error("Gagal memuat devices");
    }
  };

  const fetchContacts = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!selectedDevice) {
        setContacts([]);
        setLoading(false);
        return;
      }

      // Fetch real WhatsApp conversations from database
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("user_id", user.id)
        .eq("device_id", selectedDevice)
        .order("updated_at", { ascending: false })
        .limit(100); // Limit for performance

      if (error) throw error;

      setContacts(data || []);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      toast.error("Gagal memuat percakapan");
    } finally {
      setLoading(false);
    }
  }, [selectedDevice]);

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: true });

      if (error) throw error;

      setMessages(data || []);

      // Mark conversation as read
      await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId
      });
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error("Gagal memuat pesan");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedContact || !selectedDevice || sending) {
      if (!selectedContact || !selectedDevice) {
        toast.error("Pilih device dan kontak terlebih dahulu");
      }
      return;
    }

    // Prevent double submission
    setSending(true);

    try {
      const messageContent = newMessage;
      setNewMessage(""); // Clear input immediately for better UX

      // Call Edge Function to send message via Baileys
      const { data, error } = await supabase.functions.invoke('send-crm-message', {
        body: {
          deviceId: selectedDevice,
          conversationId: selectedContact.id,
          contactJid: selectedContact.contact_jid,
          messageContent: messageContent,
          messageType: 'text'
        }
      });

      if (error) {
        throw error;
      }

      toast.success("Pesan terkirim ke WhatsApp!");

      // Message will appear automatically via realtime subscription
      // No need to manually add it to messages array

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error("Gagal mengirim pesan: " + (error.message || 'Unknown error'));
      setNewMessage(messageContent); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = async (contactId: string) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const newStarred = !contact.is_starred;

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ is_starred: newStarred })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(contacts.map(c =>
        c.id === contactId ? { ...c, is_starred: newStarred } : c
      ));

      if (selectedContact?.id === contactId) {
        setSelectedContact({ ...selectedContact, is_starred: newStarred });
      }

      toast.success(newStarred ? "Ditambahkan ke starred" : "Dihapus dari starred");
    } catch (error) {
      console.error('Error toggling star:', error);
      toast.error("Gagal mengupdate status");
    }
  };

  const handleArchiveChat = async (contactId: string) => {
    try {
      const contact = contacts.find(c => c.id === contactId);
      if (!contact) return;

      const newArchived = !contact.is_archived;

      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ is_archived: newArchived })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(contacts.map(c =>
        c.id === contactId ? { ...c, is_archived: newArchived } : c
      ));

      if (selectedContact?.id === contactId) {
        setSelectedContact(null);
      }

      toast.success(newArchived ? "Chat diarsipkan" : "Chat dipulihkan");
    } catch (error) {
      console.error('Error archiving chat:', error);
      toast.error("Gagal mengupdate status");
    }
  };

  const handleSetLabel = async (contactId: string, label: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ label })
        .eq('id', contactId);

      if (error) throw error;

      setContacts(contacts.map(c =>
        c.id === contactId ? { ...c, label } : c
      ));

      if (selectedContact?.id === contactId) {
        setSelectedContact({ ...selectedContact, label });
      }

      toast.success("Label diperbarui");
    } catch (error) {
      console.error('Error setting label:', error);
      toast.error("Gagal mengupdate label");
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedContact) return;

    try {
      const { error } = await supabase
        .from('whatsapp_conversations')
        .update({ notes: contactNotes })
        .eq('id', selectedContact.id);

      if (error) throw error;

      setContacts(contacts.map(c =>
        c.id === selectedContact.id ? { ...c, notes: contactNotes } : c
      ));

      setSelectedContact({ ...selectedContact, notes: contactNotes });
      toast.success("Notes disimpan");
    } catch (error) {
      console.error('Error saving notes:', error);
      toast.error("Gagal menyimpan notes");
    }
  };

  const handleUseQuickReply = (reply: QuickReply) => {
    setNewMessage(reply.message);
    setShowQuickReplies(false);
  };

  const handleSaveQuickReply = () => {
    if (!newQuickReply.name.trim() || !newQuickReply.message.trim()) {
      toast.error("Nama dan pesan tidak boleh kosong");
      return;
    }

    if (editingQuickReply) {
      setQuickReplies(quickReplies.map(qr =>
        qr.id === editingQuickReply.id
          ? { ...qr, name: newQuickReply.name, message: newQuickReply.message }
          : qr
      ));
      toast.success("Quick reply diperbarui");
    } else {
      const newQR: QuickReply = {
        id: Date.now().toString(),
        name: newQuickReply.name,
        message: newQuickReply.message,
      };
      setQuickReplies([...quickReplies, newQR]);
      toast.success("Quick reply ditambahkan");
    }

    setNewQuickReply({ name: "", message: "" });
    setEditingQuickReply(null);
    setShowQuickReplies(false);
  };

  const handleDeleteQuickReply = (id: string) => {
    setQuickReplies(quickReplies.filter(qr => qr.id !== id));
    toast.success("Quick reply dihapus");
  };

  const filteredContacts = useMemo(() => {
    return contacts.filter((contact) => {
      const matchesSearch =
        String(contact.contact_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(contact.contact_phone || '').includes(searchQuery);

      const matchesFilter =
        chatFilter === "all" ? !contact.is_archived :
        chatFilter === "unread" ? (contact.unread_count || 0) > 0 && !contact.is_archived :
        chatFilter === "starred" ? contact.is_starred && !contact.is_archived :
        chatFilter === "archived" ? contact.is_archived :
        true;

      return matchesSearch && matchesFilter;
    });
  }, [contacts, searchQuery, chatFilter]);

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case "sent":
        return <Check className="w-3 h-3" />;
      case "delivered":
      case "read":
        return <CheckCheck className="w-3 h-3" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-destructive" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">CRM Chat</h1>
            <p className="text-muted-foreground">
              Kelola percakapan WhatsApp dengan fitur CRM lengkap
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={showQuickReplies} onOpenChange={setShowQuickReplies}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Zap className="w-4 h-4 mr-2" />
                  Quick Replies ({quickReplies.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Quick Replies</DialogTitle>
                  <DialogDescription>
                    Kelola template pesan cepat untuk percakapan Anda
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Tambah/Edit Quick Reply</Label>
                    <Input
                      placeholder="Nama (contoh: Greeting)"
                      value={newQuickReply.name}
                      onChange={(e) => setNewQuickReply({ ...newQuickReply, name: e.target.value })}
                    />
                    <Textarea
                      placeholder="Pesan template..."
                      value={newQuickReply.message}
                      onChange={(e) => setNewQuickReply({ ...newQuickReply, message: e.target.value })}
                      rows={3}
                    />
                    <Button onClick={handleSaveQuickReply} className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      {editingQuickReply ? "Update" : "Tambah"} Quick Reply
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <Label className="mb-3 block">Quick Replies Tersimpan</Label>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {quickReplies.map((reply) => (
                          <Card key={reply.id} className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm mb-1">{reply.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {reply.message}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    setEditingQuickReply(reply);
                                    setNewQuickReply({ name: reply.name, message: reply.message });
                                  }}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleDeleteQuickReply(reply.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Device Selection */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Phone className="w-5 h-5 text-primary" />
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="w-full max-w-xs">
                  <SelectValue placeholder="Pilih Device WhatsApp" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.device_name} - {device.phone_number || "Tidak ada nomor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {devices.length === 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Tidak ada device yang terhubung. Hubungkan device terlebih dahulu.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Contact List - 4 columns */}
          <div className="lg:col-span-4">
            <Card className="h-[700px] flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Percakapan</CardTitle>
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                {/* Search */}
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari kontak..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filter Tabs */}
                <Tabs value={chatFilter} onValueChange={(v) => setChatFilter(v as any)} className="px-4">
                  <TabsList className="grid w-full grid-cols-4 mb-3">
                    <TabsTrigger value="all" className="text-xs">
                      Semua
                    </TabsTrigger>
                    <TabsTrigger value="unread" className="text-xs">
                      Unread
                    </TabsTrigger>
                    <TabsTrigger value="starred" className="text-xs">
                      <Star className="w-3 h-3" />
                    </TabsTrigger>
                    <TabsTrigger value="archived" className="text-xs">
                      <Archive className="w-3 h-3" />
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Contact List */}
                <ScrollArea className="flex-1">
                  <div className="px-2">
                    {filteredContacts.map((contact) => {
                      const label = CHAT_LABELS.find(l => l.value === contact.label);

                      return (
                        <div
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className={`p-3 mb-1 rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                            selectedContact?.id === contact.id ? "bg-accent" : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {String(contact.contact_name || 'U').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">
                                    {String(contact.contact_name || 'Unknown')}
                                  </p>
                                  {contact.is_starred && (
                                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                                  )}
                                </div>
                                {contact.unread_count && contact.unread_count > 0 && (
                                  <Badge variant="destructive" className="text-xs h-5 px-1.5">
                                    {contact.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate mb-1">
                                {String(contact.contact_phone || '')}
                              </p>
                              {label && (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${label.color} text-white`}
                                >
                                  {label.label}
                                </Badge>
                              )}
                              {contact.last_message_preview && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {String(contact.last_message_preview)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {filteredContacts.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">Tidak ada kontak ditemukan</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Chat Window - 5 columns */}
          <div className="lg:col-span-5">
            <Card className="h-[700px] flex flex-col">
              <CardContent className="p-0 flex flex-col h-full">
                {selectedContact ? (
                  <>
                    {/* Chat Header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {String(selectedContact.contact_name || 'U').substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{String(selectedContact.contact_name || 'Unknown')}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {String(selectedContact.contact_phone || '')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStar(selectedContact.id)}
                        >
                          <Star
                            className={`w-4 h-4 ${
                              selectedContact.is_starred
                                ? "fill-yellow-500 text-yellow-500"
                                : ""
                            }`}
                          />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setShowContactInfo(!showContactInfo)}
                            >
                              <Info className="w-4 h-4 mr-2" />
                              Info Kontak
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {CHAT_LABELS.map((label) => (
                              <DropdownMenuItem
                                key={label.value}
                                onClick={() => handleSetLabel(selectedContact.id, label.value)}
                              >
                                <Tag className="w-4 h-4 mr-2" />
                                Label: {label.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleArchiveChat(selectedContact.id)}
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              {selectedContact.is_archived ? "Unarchive" : "Archive"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-4">
                        {messages.length === 0 && (
                          <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p className="font-medium mb-1">Belum ada percakapan</p>
                            <p className="text-sm">Mulai kirim pesan ke {String(selectedContact.contact_name || 'kontak ini')}</p>
                          </div>
                        )}
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.from_me ? "justify-end" : "justify-start"
                            }`}
                          >
                            <div
                              className={`max-w-[75%] rounded-lg p-3 ${
                                message.from_me
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              {message.media_url && (
                                <div className="mb-2">
                                  {message.message_type === "image" ? (
                                    <img
                                      src={message.media_url}
                                      alt="Media"
                                      className="rounded max-w-full h-auto"
                                    />
                                  ) : message.message_type === "video" ? (
                                    <video
                                      src={message.media_url}
                                      controls
                                      className="rounded max-w-full h-auto"
                                    />
                                  ) : (
                                    <div className="flex items-center gap-2 p-2 bg-background/10 rounded">
                                      <FileText className="w-4 h-4" />
                                      <span className="text-xs">File attachment</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              <p className="text-sm break-words">{message.message_content || message.caption}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <p
                                  className={`text-xs ${
                                    message.from_me
                                      ? "text-primary-foreground/70"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {new Date(message.timestamp).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                {message.from_me && (
                                  <span
                                    className={
                                      message.from_me
                                        ? "text-primary-foreground/70"
                                        : "text-muted-foreground"
                                    }
                                  >
                                    {getMessageStatusIcon(message.status)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>

                    {/* Quick Replies Bar */}
                    <div className="px-4 py-2 border-t border-border bg-muted/30">
                      <div className="flex gap-2 overflow-x-auto">
                        {quickReplies.slice(0, 3).map((reply) => (
                          <Button
                            key={reply.id}
                            variant="outline"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => handleUseQuickReply(reply)}
                          >
                            <Zap className="w-3 h-3 mr-1" />
                            {reply.name}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Message Input */}
                    <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Ketik pesan..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          type="submit"
                          className="bg-gradient-to-r from-primary to-secondary"
                          disabled={!newMessage.trim() || sending}
                        >
                          {sending ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </span>
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </form>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <MessageSquare className="w-20 h-20 mb-4 opacity-20" />
                    <p className="font-medium text-lg mb-2">Selamat Datang di CRM Chat</p>
                    <p className="text-sm text-center max-w-md">
                      Pilih kontak dari daftar di sebelah kiri untuk memulai percakapan.
                      Gunakan fitur label, notes, dan quick replies untuk mengelola customer dengan lebih baik.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Info Sidebar - 3 columns */}
          <div className="lg:col-span-3">
            <Card className="h-[700px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Info Kontak
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedContact ? (
                  <>
                    {/* Contact Avatar and Name */}
                    <div className="text-center pb-4 border-b">
                      <Avatar className="h-20 w-20 mx-auto mb-3">
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                          {String(selectedContact.contact_name || 'U').substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-lg">{String(selectedContact.contact_name || 'Unknown')}</p>
                      <p className="text-sm text-muted-foreground">{String(selectedContact.contact_phone || '')}</p>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">Label</Label>
                        <div className="mt-1">
                          {selectedContact.label ? (
                            <Badge
                              className={
                                CHAT_LABELS.find(l => l.value === selectedContact.label)?.color +
                                " text-white"
                              }
                            >
                              {CHAT_LABELS.find(l => l.value === selectedContact.label)?.label}
                            </Badge>
                          ) : (
                            <p className="text-sm text-muted-foreground">Belum ada label</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Bergabung Sejak</Label>
                        <p className="text-sm mt-1">
                          {selectedContact.created_at
                            ? new Date(selectedContact.created_at).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "-"}
                        </p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Status</Label>
                        <div className="flex gap-2 mt-1">
                          <Badge variant={selectedContact.is_starred ? "default" : "outline"}>
                            <Star className="w-3 h-3 mr-1" />
                            {selectedContact.is_starred ? "Starred" : "Not Starred"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Notes Section */}
                    <div className="pt-4 border-t">
                      <Label className="flex items-center gap-2 mb-2">
                        <StickyNote className="w-4 h-4" />
                        Notes (Internal)
                      </Label>
                      <Textarea
                        placeholder="Tambahkan catatan tentang kontak ini..."
                        value={contactNotes}
                        onChange={(e) => setContactNotes(e.target.value)}
                        rows={6}
                        className="resize-none text-sm"
                      />
                      <Button
                        onClick={handleSaveNotes}
                        className="w-full mt-2"
                        size="sm"
                      >
                        Simpan Notes
                      </Button>
                    </div>

                    {/* Quick Actions */}
                    <div className="pt-4 border-t space-y-2">
                      <Label className="text-xs text-muted-foreground">Quick Actions</Label>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        size="sm"
                        onClick={() => handleToggleStar(selectedContact.id)}
                      >
                        <Star className="w-4 h-4 mr-2" />
                        {selectedContact.is_starred ? "Remove Star" : "Add Star"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        size="sm"
                        onClick={() => handleArchiveChat(selectedContact.id)}
                      >
                        <Archive className="w-4 h-4 mr-2" />
                        {selectedContact.is_archived ? "Unarchive" : "Archive Chat"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    <User className="w-16 h-16 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Pilih kontak untuk melihat info detail</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CrmChat;
