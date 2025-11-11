import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare, Send, Users, Radio, AlertCircle, CheckCircle2, Loader2, Filter } from "lucide-react";
import { logAudit } from "@/utils/auditLogger";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[];
}

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
}

interface BroadcastHistory {
  id: string;
  name: string;
  sent_count: number;
  failed_count: number;
  status: string;
  created_at: string;
  target_count: number;
}

export const AdminBroadcast = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [message, setMessage] = useState("");
  const [broadcastName, setBroadcastName] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);

  useEffect(() => {
    fetchData();
    
    // Real-time updates for contacts
    const channel = supabase
      .channel("admin-contacts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contacts"
        },
        () => {
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchContacts(), fetchDevices(), fetchBroadcastHistory()]);
    setLoading(false);
  };

  const fetchContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("contacts")
        .select("id, phone_number, name, tags")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts");
    }
  };

  const fetchDevices = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("devices")
        .select("id, device_name, status, phone_number")
        .eq("user_id", user.id)
        .eq("status", "connected");

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error("Error fetching devices:", error);
    }
  };

  const fetchBroadcastHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("broadcasts")
        .select("id, name, sent_count, failed_count, status, created_at, target_contacts")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      
      const history: BroadcastHistory[] = data?.map(b => ({
        id: b.id,
        name: b.name,
        sent_count: b.sent_count || 0,
        failed_count: b.failed_count || 0,
        status: b.status,
        created_at: b.created_at,
        target_count: Array.isArray(b.target_contacts) ? b.target_contacts.length : 0
      })) || [];

      setBroadcastHistory(history);
    } catch (error: any) {
      console.error("Error fetching broadcast history:", error);
    }
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesTag = filterTag === "all" || contact.tags?.includes(filterTag);
    const matchesSearch = 
      searchQuery === "" ||
      contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phone_number.includes(searchQuery);
    return matchesTag && matchesSearch;
  });

  const uniqueTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])));

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id));
    }
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleSendBroadcast = async () => {
    if (!selectedDevice) {
      toast.error("Please select a device");
      return;
    }
    if (selectedContacts.length === 0) {
      toast.error("Please select at least one contact");
      return;
    }
    if (!message.trim()) {
      toast.error("Please enter a message");
      return;
    }
    if (!broadcastName.trim()) {
      toast.error("Please enter a broadcast name");
      return;
    }

    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get selected contacts details
      const selectedContactsData = contacts.filter(c => selectedContacts.includes(c.id));
      const targetContacts = selectedContactsData.map(c => ({
        phone: c.phone_number,
        name: c.name || c.phone_number
      }));

      // Create broadcast
      const { data: broadcast, error: broadcastError } = await supabase
        .from("broadcasts")
        .insert({
          user_id: user.id,
          device_id: selectedDevice,
          name: broadcastName,
          message: message,
          status: "sending",
          target_contacts: targetContacts
        })
        .select()
        .single();

      if (broadcastError) throw broadcastError;

      // Queue messages
      const messagePromises = targetContacts.map(contact => 
        supabase.from("message_queue").insert({
          user_id: user.id,
          device_id: selectedDevice,
          to_phone: contact.phone,
          message: message,
          message_type: "text",
          status: "pending"
        })
      );

      await Promise.all(messagePromises);

      // Log audit
      await logAudit({
        action: "create",
        entity_type: "broadcast",
        entity_id: broadcast.id,
        new_values: {
          name: broadcastName,
          contacts_count: targetContacts.length
        }
      });

      toast.success(`Broadcast queued! Sending to ${targetContacts.length} contacts`);
      
      // Reset form
      setSelectedContacts([]);
      setMessage("");
      setBroadcastName("");
      fetchBroadcastHistory();

    } catch (error: any) {
      console.error("Error sending broadcast:", error);
      toast.error(error.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "sending":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Radio className="w-8 h-8 text-primary" />
            Admin Broadcast
          </h1>
          <p className="text-muted-foreground mt-2">
            Broadcast messages ke customer WhatsApp secara otomatis
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Total Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{contacts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {contacts.filter(c => c.tags?.includes("customer")).length} auto-synced customers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Connected Devices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{devices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Available for broadcasting</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Selected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedContacts.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Recipients selected</p>
            </CardContent>
          </Card>
        </div>

        {/* Broadcast Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Broadcast</CardTitle>
            <CardDescription>Send messages to multiple customers at once</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Broadcast Name</Label>
              <Input
                placeholder="e.g., Holiday Promotion"
                value={broadcastName}
                onChange={(e) => setBroadcastName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Select Device</Label>
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose WhatsApp device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.length === 0 ? (
                    <SelectItem value="none" disabled>No connected devices</SelectItem>
                  ) : (
                    devices.map(device => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.device_name} ({device.phone_number || "No number"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {devices.length === 0 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  No connected devices available
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                placeholder="Enter your broadcast message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">{message.length} characters</p>
            </div>

            <Button
              onClick={handleSendBroadcast}
              disabled={sending || selectedContacts.length === 0 || !selectedDevice}
              className="w-full"
              size="lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Contact Selection */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Recipients</CardTitle>
                <CardDescription>Choose contacts for broadcast</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedContacts.length === filteredContacts.length ? "Deselect All" : "Select All"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={filterTag} onValueChange={setFilterTag}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tags</SelectItem>
                  {uniqueTags.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact List */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No contacts found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredContacts.map(contact => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedContacts.includes(contact.id)}
                            onCheckedChange={() => handleContactToggle(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {contact.name || "Unknown"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {contact.phone_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {contact.tags?.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Broadcast History */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Broadcasts</CardTitle>
            <CardDescription>Last 10 broadcast campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {broadcastHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No broadcasts yet</p>
              ) : (
                broadcastHistory.map(broadcast => (
                  <div key={broadcast.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{broadcast.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(broadcast.created_at).toLocaleString("id-ID")} • {broadcast.target_count} recipients
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm">
                        <p className="text-green-500">{broadcast.sent_count} sent</p>
                        {broadcast.failed_count > 0 && (
                          <p className="text-destructive">{broadcast.failed_count} failed</p>
                        )}
                      </div>
                      <Badge variant={getStatusColor(broadcast.status)}>
                        {broadcast.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminBroadcast;
