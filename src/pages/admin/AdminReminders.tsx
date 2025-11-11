import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bell, Plus, Play, Pause, Trash2, Send, Clock, Users, TrendingUp, Calendar, MessageSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";

interface ReminderConfig {
  id: string;
  name: string;
  description: string;
  reminder_type: string;
  trigger_days_before: number[];
  target_segment: string;
  message_template: string;
  is_active: boolean;
  auto_send: boolean;
  device_id: string;
  total_sent: number;
  last_sent_at: string;
  send_time: string;
}

interface Device {
  id: string;
  device_name: string;
  status: string;
}

export default function AdminReminders() {
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sent_today: 0 });
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    reminder_type: "subscription_renewal",
    trigger_days_before: [7, 3, 1],
    target_segment: "expiring_soon",
    message_template: "",
    device_id: "",
    auto_send: true,
    send_time: "10:00:00"
  });

  useEffect(() => {
    fetchReminders();
    fetchDevices();
    fetchStats();
  }, []);

  const fetchReminders = async () => {
    try {
      const { data, error } = await supabase
        .from("reminder_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReminders(data || []);
    } catch (error: any) {
      toast.error("Failed to load reminders: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("id, device_name, status")
        .eq("status", "connected");

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      console.error("Failed to load devices:", error.message);
    }
  };

  const fetchStats = async () => {
    try {
      const { data: configs } = await supabase
        .from("reminder_configs")
        .select("id, is_active, total_sent");

      const { data: logsToday } = await supabase
        .from("reminder_logs")
        .select("id")
        .gte("created_at", new Date().toISOString().split("T")[0]);

      setStats({
        total: configs?.length || 0,
        active: configs?.filter(c => c.is_active).length || 0,
        sent_today: logsToday?.length || 0
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const handleCreateReminder = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("reminder_configs")
        .insert({
          ...formData,
          created_by: user.id
        });

      if (error) throw error;

      toast.success("Reminder created successfully!");
      setShowCreateDialog(false);
      fetchReminders();
      fetchStats();
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        reminder_type: "subscription_renewal",
        trigger_days_before: [7, 3, 1],
        target_segment: "expiring_soon",
        message_template: "",
        device_id: "",
        auto_send: true,
        send_time: "10:00:00"
      });
    } catch (error: any) {
      toast.error("Failed to create reminder: " + error.message);
    }
  };

  const toggleReminderStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("reminder_configs")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(currentStatus ? "Reminder paused" : "Reminder activated");
      fetchReminders();
      fetchStats();
    } catch (error: any) {
      toast.error("Failed to update reminder: " + error.message);
    }
  };

  const deleteReminder = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reminder?")) return;

    try {
      const { error } = await supabase
        .from("reminder_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Reminder deleted successfully");
      fetchReminders();
      fetchStats();
    } catch (error: any) {
      toast.error("Failed to delete reminder: " + error.message);
    }
  };

  const sendManualReminder = async () => {
    toast.info("Manual reminder feature - coming soon!");
  };

  const reminderTypeLabels: Record<string, string> = {
    subscription_renewal: "Subscription Renewal",
    payment_due: "Payment Due",
    custom: "Custom Reminder"
  };

  const targetSegmentLabels: Record<string, string> = {
    all: "All Users",
    expiring_soon: "Expiring Soon (< 7 days)",
    expired: "Expired Users",
    custom: "Custom Segment"
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Bell className="w-8 h-8 text-primary" />
              Reminder Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Automated WhatsApp reminders for subscription renewals and payments
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Reminder
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Reminder</DialogTitle>
                <DialogDescription>
                  Configure automated reminders for your customers
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Reminder Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Subscription Expiry Alert"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this reminder"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reminder_type">Reminder Type</Label>
                    <Select
                      value={formData.reminder_type}
                      onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscription_renewal">Subscription Renewal</SelectItem>
                        <SelectItem value="payment_due">Payment Due</SelectItem>
                        <SelectItem value="custom">Custom Reminder</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="target_segment">Target Segment</Label>
                    <Select
                      value={formData.target_segment}
                      onValueChange={(value) => setFormData({ ...formData, target_segment: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expiring_soon">Expiring Soon (&lt; 7 days)</SelectItem>
                        <SelectItem value="expired">Expired Users</SelectItem>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="custom">Custom Segment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="device">WhatsApp Device *</Label>
                  <Select
                    value={formData.device_id}
                    onValueChange={(value) => setFormData({ ...formData, device_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select device" />
                    </SelectTrigger>
                    <SelectContent>
                      {devices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.device_name} ({device.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {devices.length === 0 && (
                    <p className="text-sm text-destructive">No connected devices found</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trigger_days">Trigger Days Before Expiry</Label>
                  <Input
                    id="trigger_days"
                    value={formData.trigger_days_before.join(", ")}
                    onChange={(e) => {
                      const days = e.target.value.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d));
                      setFormData({ ...formData, trigger_days_before: days });
                    }}
                    placeholder="e.g., 7, 3, 1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter days separated by commas (e.g., 7, 3, 1 for reminders 7, 3, and 1 days before expiry)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="send_time">Send Time</Label>
                  <Input
                    id="send_time"
                    type="time"
                    value={formData.send_time}
                    onChange={(e) => setFormData({ ...formData, send_time: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message Template *</Label>
                  <Textarea
                    id="message"
                    value={formData.message_template}
                    onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
                    placeholder="Hi {{name}}, your subscription will expire in {{days}} days. Please renew to continue using our service."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use variables: {'{{name}}'}, {'{{days}}'}, {'{{plan}}'}, {'{{expires_at}}'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto_send"
                    checked={formData.auto_send}
                    onCheckedChange={(checked) => setFormData({ ...formData, auto_send: checked })}
                  />
                  <Label htmlFor="auto_send" className="cursor-pointer">
                    Enable automatic sending
                  </Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleCreateReminder}
                    disabled={!formData.name || !formData.message_template || !formData.device_id}
                    className="flex-1"
                  >
                    Create Reminder
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Reminders</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.total}</p>
              </div>
              <Bell className="w-10 h-10 text-primary opacity-20" />
            </div>
          </Card>

          <Card className="p-6 border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Reminders</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.active}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </Card>

          <Card className="p-6 border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sent Today</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stats.sent_today}</p>
              </div>
              <MessageSquare className="w-10 h-10 text-blue-500 opacity-20" />
            </div>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="automatic" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="automatic" className="gap-2">
              <Clock className="w-4 h-4" />
              Automatic Reminders
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Send className="w-4 h-4" />
              Manual Send
            </TabsTrigger>
          </TabsList>

          {/* Automatic Reminders Tab */}
          <TabsContent value="automatic" className="space-y-4">
            {loading ? (
              <Card className="p-8">
                <div className="text-center text-muted-foreground">Loading reminders...</div>
              </Card>
            ) : reminders.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">No reminders configured yet</p>
                  <Button onClick={() => setShowCreateDialog(true)} className="mt-4 gap-2">
                    <Plus className="w-4 h-4" />
                    Create Your First Reminder
                  </Button>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4">
                {reminders.map((reminder) => (
                  <Card key={reminder.id} className="p-6 hover:border-primary/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{reminder.name}</h3>
                          <Badge variant={reminder.is_active ? "default" : "secondary"}>
                            {reminder.is_active ? "Active" : "Paused"}
                          </Badge>
                          {reminder.auto_send && (
                            <Badge variant="outline" className="gap-1">
                              <Clock className="w-3 h-3" />
                              Auto
                            </Badge>
                          )}
                        </div>
                        
                        {reminder.description && (
                          <p className="text-sm text-muted-foreground mb-3">{reminder.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Type</p>
                            <p className="font-medium text-foreground">
                              {reminderTypeLabels[reminder.reminder_type]}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Target</p>
                            <p className="font-medium text-foreground">
                              {targetSegmentLabels[reminder.target_segment]}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Trigger Days</p>
                            <p className="font-medium text-foreground">
                              {reminder.trigger_days_before.join(", ")} days
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Sent</p>
                            <p className="font-medium text-foreground">{reminder.total_sent}</p>
                          </div>
                        </div>

                        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Message Preview</p>
                          <p className="text-sm text-foreground line-clamp-2">{reminder.message_template}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => toggleReminderStatus(reminder.id, reminder.is_active)}
                          title={reminder.is_active ? "Pause" : "Activate"}
                        >
                          {reminder.is_active ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReminder(reminder.id)}
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Manual Send Tab */}
          <TabsContent value="manual" className="space-y-4">
            <Card className="p-8">
              <div className="text-center max-w-md mx-auto">
                <Send className="w-16 h-16 text-primary mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold mb-2">Send Manual Reminders</h3>
                <p className="text-muted-foreground mb-6">
                  Quickly send one-time reminder messages to selected users or segments
                </p>
                <Button onClick={sendManualReminder} className="gap-2">
                  <Send className="w-4 h-4" />
                  Send Manual Reminder
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
