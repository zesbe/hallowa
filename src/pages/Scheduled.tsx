import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Send, XCircle, Edit, Trash2, CheckCircle2, Image as ImageIcon, Users } from "lucide-react";
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
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [newScheduledTime, setNewScheduledTime] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchBroadcasts();

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
          fetchBroadcasts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from("broadcasts")
        .select("*")
        .not("scheduled_at", "is", null)
        .order("scheduled_at", { ascending: true });

      if (error) throw error;
      setBroadcasts((data || []) as Broadcast[]);
    } catch (error: any) {
      toast.error("Gagal memuat broadcast terjadwal");
    } finally {
      setLoading(false);
    }
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
      fetchBroadcasts();
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
      fetchBroadcasts();
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
      fetchBroadcasts();
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
      fetchBroadcasts();
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
        <div>
          <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-1 md:mb-2">Jadwal Broadcast</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Kelola broadcast terjadwal dan lihat riwayat pengiriman
          </p>
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
                    Buat broadcast baru di halaman Broadcast dan atur jadwal pengiriman
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
