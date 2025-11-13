import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Smartphone, QrCode, Trash2, RefreshCw, Copy, LogOut, Info, RotateCcw, Database, Bell, BellOff, AlertCircle } from "lucide-react";
import { useEffect, useState, useCallback, useRef, useMemo, startTransition } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  requestNotificationPermission,
  notifyDeviceConnected,
  notifyDeviceDisconnected,
  notifyDeviceError
} from "@/utils/notifications";
import { DeviceCard } from "@/components/DeviceCard";
import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SecureInput } from "@/components/secure"; // 🔒 XSS Protection

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  pairing_code: string | null;
  connection_method: string | null;
  phone_for_pairing: string | null;
  last_connected_at: string | null;
  api_key: string | null;
  server_id: string | null;
  webhook_url: string | null;
  is_multidevice: boolean;
}

export const Devices = () => {
  const { canAddDevice, isLimitReached, subscription, refreshUsage } = useSubscription();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<string>("idle");
  const [qrExpiry, setQrExpiry] = useState<number>(0);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [swipedDeviceId, setSwipedDeviceId] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pairing'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const lastNotificationRef = useRef<{ [key: string]: number }>({});

  // Get user ID on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserId(data.user.id);
      }
    });
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(granted => {
      setNotificationsEnabled(granted);
    });
  }, []);

  // Throttle toast notifications to avoid spam
  const shouldShowNotification = useCallback((deviceId: string, notificationType: string) => {
    const now = Date.now();
    const key = `${deviceId}-${notificationType}`;
    const lastNotification = lastNotificationRef.current[key] || 0;

    // Only show notification if last one was more than 5 seconds ago
    if (now - lastNotification > 5000) {
      lastNotificationRef.current[key] = now;
      return true;
    }
    return false;
  }, []);

  // Realtime subscription effect - only runs when userId is available
  useEffect(() => {
    if (!userId) return;

    // Initial fetch
    fetchDevices();

    // Subscribe to real-time updates for current user's devices only
    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices',
          filter: `user_id=eq.${userId}` // Only listen to current user's devices
        },
        (payload) => {
          console.log('🔄 Realtime update:', payload.eventType, payload);

          // Batch updates using startTransition for smoother, non-blocking updates
          startTransition(() => {
            // Update local state with smooth transitions
            if (payload.eventType === 'INSERT') {
              const newDevice = payload.new as Device;
              setDevices(prev => [newDevice, ...prev]);
              console.log('✅ Device added via realtime');
            }
            else if (payload.eventType === 'UPDATE') {
              const updatedDevice = payload.new as Device;
              setDevices(prev => prev.map(d => d.id === updatedDevice.id ? updatedDevice : d));
              console.log('✅ Device updated via realtime:', updatedDevice.id);

              // Send notifications for device status changes (throttled)
              if (notificationsEnabled) {
                const oldStatus = payload.old?.status;
                const newStatus = payload.new?.status;
                const deviceName = payload.new?.device_name;
                const deviceId = payload.new?.id;

                if (oldStatus !== newStatus && deviceName && deviceId) {
                  if (newStatus === 'connected' && shouldShowNotification(deviceId, 'connected')) {
                    notifyDeviceConnected(deviceName);
                    toast.success(`${deviceName} Terhubung! ✅`, {
                      description: 'Device berhasil connect ke WhatsApp',
                      duration: 3000
                    });
                  } else if (newStatus === 'disconnected' && oldStatus === 'connected' && shouldShowNotification(deviceId, 'disconnected')) {
                    notifyDeviceDisconnected(deviceName);
                    toast.warning(`${deviceName} Terputus ⚠️`, {
                      description: 'Koneksi WhatsApp terputus',
                      duration: 3000
                    });
                  } else if (newStatus === 'error' && shouldShowNotification(deviceId, 'error')) {
                    notifyDeviceError(deviceName);
                    toast.error(`${deviceName} Error ❌`, {
                      description: 'Terjadi kesalahan pada device',
                      duration: 3000
                    });
                  }
                  // Skip toast for 'connecting' status to reduce notification spam
                }
              }

              // Auto-close dialog when connected
              if (payload.new?.status === 'connected' && selectedDevice?.id === payload.new.id) {
                if (connectionStatus !== 'pairing_ready') {
                  setTimeout(() => {
                    setQrDialogOpen(false);
                    setConnectionStatus("idle");
                  }, 1500);
                }
              }
            }
            else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              setDevices(prev => prev.filter(d => d.id !== deletedId));
              console.log('✅ Device deleted via realtime:', deletedId);
            }
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true);
          // Silent realtime connection - no toast
        } else if (status === 'CHANNEL_ERROR') {
          setRealtimeConnected(false);
          toast.error('Realtime sync error 🔴', { duration: 2000 });
        }
      });

    return () => {
      console.log('🔌 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [userId, notificationsEnabled, shouldShowNotification, selectedDevice?.id, connectionStatus, pollingInterval]);

  // QR expiry countdown
  useEffect(() => {
    if (qrExpiry > 0 && qrDialogOpen) {
      const timer = setTimeout(() => {
        setQrExpiry(qrExpiry - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (qrExpiry === 0 && connectionStatus === "qr_ready") {
      setConnectionStatus("qr_expired");
    }
  }, [qrExpiry, qrDialogOpen, connectionStatus]);

  const fetchDevices = async () => {
    try {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat data device");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check limit
    if (!canAddDevice()) {
      toast.error("Limit device tercapai!", {
        description: `Plan Anda hanya mengizinkan ${subscription?.plan?.max_devices || 0} device. Upgrade plan untuk menambah lebih banyak.`
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("devices").insert({
        user_id: user.id,
        device_name: deviceName,
        status: "disconnected",
      });

      if (error) throw error;

      toast.success("Device berhasil ditambahkan", { duration: 2000 });
      setDeviceName("");
      setDialogOpen(false);
      // No need to call fetchDevices() - realtime will handle it
      refreshUsage(); // Refresh usage stats
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleConnectDevice = async (device: Device, method?: 'qr' | 'pairing', phone?: string) => {
    setSelectedDevice(device);
    setQrDialogOpen(true);
    
    // If no method specified, show selection dialog
    if (!method) {
      setConnectionStatus("idle");
      return;
    }

    setConnectionStatus("connecting");
    setQrExpiry(60);
    
    try {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      // Update device status to 'connecting' - Railway service will detect this
      const updateData: any = { 
        status: "connecting",
        qr_code: null,
        pairing_code: null,
        connection_method: method
      };

      if (method === 'pairing' && phone) {
        updateData.phone_for_pairing = phone;
      }

      const { error } = await supabase
        .from("devices")
        .update(updateData)
        .eq("id", device.id);

      if (error) throw error;

      setConnectionStatus(method === 'qr' ? "generating_qr" : "generating_pairing");
      toast.info(method === 'qr' ? "Menghubungkan ke WhatsApp..." : "Membuat kode pairing...", { duration: 2000 });

      // Poll updates from DB and fetch ephemeral codes from Edge Function (Redis)
      const interval = setInterval(async () => {
        // 1) Read latest device row
        const { data: row, error: rowError } = await supabase
          .from("devices")
          .select("*")
          .eq("id", device.id)
          .single();

        if (rowError) {
          console.error("Polling error:", rowError);
          return;
        }

        // 2) Fetch QR/Pairing codes from Edge Function (stored in Redis)
        let qrCode: string | null = null;
        let pairingCode: string | null = null;
        try {
          const { data: codes, error: fnError } = await supabase.functions.invoke('get-device-qr', {
            body: { deviceId: device.id },
          });
          
          if (fnError) {
            console.warn('Edge function error:', fnError);
          } else {
            qrCode = codes?.qrCode ?? null;
            pairingCode = codes?.pairingCode ?? null;
            
            // Debug logging
            if (pairingCode) {
              console.log('📱 Pairing code received:', pairingCode);
            }
            if (qrCode) {
              console.log('📷 QR code received: [data URL]');
            }
          }
        } catch (fnErr) {
          // Non-fatal: just log
          console.debug('get-device-qr error (non-fatal):', fnErr);
        }

        if (row) {
          // Merge ephemeral codes into local state (do NOT write to DB)
          const merged: any = { ...row, qr_code: qrCode, pairing_code: pairingCode };
          setSelectedDevice(merged);

          // QR flow
          if (qrCode && row.status === "connecting" && method === 'qr') {
            if (connectionStatus !== "qr_ready" || merged.qr_code !== selectedDevice?.qr_code) {
              setConnectionStatus("qr_ready");
              setQrExpiry(60);
              toast.success("QR Code siap! Scan sekarang", { duration: 2000 });
            }
          }

          // Pairing flow
          if (pairingCode && row.status === "connecting" && method === 'pairing') {
            console.log('🔐 Pairing check:', { 
              hasPairingCode: !!pairingCode, 
              code: pairingCode,
              status: row.status, 
              method, 
              currentStatus: connectionStatus 
            });
            
            if (connectionStatus !== "pairing_ready" || merged.pairing_code !== selectedDevice?.pairing_code) {
              setConnectionStatus("pairing_ready");
              toast.success(`Kode pairing siap: ${pairingCode}`, { duration: 2000 });
            }
          }

          // Connected
          if (row.status === "connected") {
            setConnectionStatus("connected");
            toast.success("WhatsApp berhasil terhubung!", { duration: 3000 });
            clearInterval(interval);
            setPollingInterval(null);
            // No need to call fetchDevices() - realtime will handle it
            setTimeout(() => {
              setQrDialogOpen(false);
              setConnectionStatus("idle");
              setPairingPhone('');
            }, 1500);
          }

          // Error
          if (row.status === "error") {
            setConnectionStatus("error");
            toast.error("Connection error. Silakan coba lagi.");
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      }, 2000); // Poll every 2 seconds - optimized with batching

      setPollingInterval(interval);

      // Auto-stop polling after 5 minutes
      setTimeout(async () => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          if (connectionStatus !== "connected") {
            setConnectionStatus(method === 'qr' ? "qr_expired" : "pairing_expired");
            toast.error(method === 'qr' ? "QR Code expired. Silakan coba lagi." : "Kode pairing expired. Silakan coba lagi.");
            if (selectedDevice) {
              await supabase
                .from("devices")
                .update({ status: "disconnected", qr_code: null, pairing_code: null })
                .eq("id", selectedDevice.id);
            }
          }
        }
      }, 300000);

    } catch (error: any) {
      setConnectionStatus("error");
      toast.error(error.message);
    }
  };

  const handleRefreshQR = () => {
    if (selectedDevice) {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      // Reconnect with same method
      const method = selectedDevice.connection_method as 'qr' | 'pairing' || 'qr';
      handleConnectDevice(selectedDevice, method, selectedDevice.phone_for_pairing || undefined);
    }
  };

  const handleCancelConnect = async () => {
    if (!selectedDevice) return;
    try {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      await supabase
        .from("devices")
        .update({ status: "disconnected", qr_code: null, pairing_code: null, connection_method: null, phone_for_pairing: null })
        .eq("id", selectedDevice.id);
    } catch (e) {
      console.error("Cancel connect error:", e);
    } finally {
      setConnectionStatus("idle");
      setQrDialogOpen(false);
    }
  };

  const handleStopConnecting = async (device: Device) => {
    try {
      await supabase
        .from("devices")
        .update({ status: "disconnected", qr_code: null, pairing_code: null, connection_method: null, phone_for_pairing: null })
        .eq("id", device.id);
      toast.success("Dibatalkan. Anda bisa scan ulang.");
      // No need to call fetchDevices() - realtime will handle it
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const handleClearSession = async (device: Device) => {
    if (!confirm("Hapus session dan autentikasi? Device perlu scan QR/pairing ulang.")) return;

    try {
      // Clear all auth data - device will need fresh QR/pairing
      await supabase
        .from("devices")
        .update({
          session_data: null,
          qr_code: null,
          pairing_code: null,
          phone_number: null,
          status: "disconnected",
          connection_method: null,
          phone_for_pairing: null
        })
        .eq("id", device.id);

      toast.success("Session dihapus. Silakan scan QR/pairing ulang.");
      // No need to call fetchDevices() - realtime will handle it
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReconnect = async (device: Device) => {
    try {
      // Just restart connection - keep session data for recovery
      toast.info("Mencoba koneksi ulang...");

      await supabase
        .from("devices")
        .update({
          status: "connecting"
        })
        .eq("id", device.id);

      // Railway service will detect status change and attempt recovery
      // No need to call fetchDevices() - realtime will handle it
      toast.success("Permintaan reconnect dikirim");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async (device: Device) => {
    if (!confirm("Logout dari WhatsApp? Session akan dihapus dan device terputus.")) return;

    try {
      // Full logout - clear everything including phone number
      await supabase
        .from("devices")
        .update({
          status: "disconnected",
          session_data: null,
          phone_number: null,
          qr_code: null,
          pairing_code: null,
          connection_method: null,
          phone_for_pairing: null
        })
        .eq("id", device.id);

      toast.success("Logout berhasil. Device terputus dari WhatsApp.");
      // No need to call fetchDevices() - realtime will handle it
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Yakin ingin menghapus device ini?")) return;

    try {
      const { error } = await supabase.from("devices").delete().eq("id", deviceId);
      if (error) throw error;

      toast.success("Device berhasil dihapus");
      // No need to call fetchDevices() - realtime will handle it
      refreshUsage(); // Refresh usage stats after deletion
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };


  const handleDetail = (device: Device) => {
    setSelectedDevice(device);
    setDetailDialogOpen(true);
  };

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500 text-white";
      case "connecting":
        return "bg-yellow-500 text-white";
      default:
        return "bg-red-500 text-white";
    }
  }, []);

  const getStatusText = useCallback((status: string) => {
    switch (status) {
      case "connected":
        return "Terkoneksi";
      case "connecting":
        return "Connecting...";
      default:
        return "Tidak Terkoneksi";
    }
  }, []);

  return (
    <Layout>
      <div className="space-y-4 md:space-y-8">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-3 mb-1 md:mb-2">
              <h1 className="text-2xl md:text-4xl font-bold text-foreground">Device Management</h1>
              {realtimeConnected && (
                <Badge className="bg-green-500 text-white text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                  Live
                </Badge>
              )}
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Kelola semua perangkat WhatsApp yang terhubung{realtimeConnected ? ' - Update realtime aktif' : ''}
            </p>
          </div>
          <div className="flex gap-2 w-full">
            <Button
              variant={notificationsEnabled ? "default" : "outline"}
              size="icon"
              className="shrink-0"
              onClick={async () => {
                const granted = await requestNotificationPermission();
                setNotificationsEnabled(granted);
                if (granted) {
                  toast.success("Notifikasi diaktifkan");
                } else {
                  toast.error("Notifikasi ditolak");
                }
              }}
              title={notificationsEnabled ? "Notifikasi aktif" : "Aktifkan notifikasi"}
            >
              {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-gradient-to-r from-primary to-secondary text-white flex-1"
                  disabled={isLimitReached('devices')}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Tambah Device</span>
                  <span className="sm:hidden">Tambah</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Device Baru</DialogTitle>
                  <DialogDescription>
                    Buat device baru untuk menghubungkan WhatsApp Anda
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateDevice} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceName">Nama Device</Label>
                    <SecureInput
                      id="deviceName"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="Contoh: WhatsApp Bisnis 1"
                      maxLength={100}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Maksimal 100 karakter. Hindari karakter spesial.
                    </p>
                  </div>
                  <Button type="submit" className="w-full">Buat Device</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLimitReached('devices') && subscription && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Limit device tercapai ({devices.length}/{subscription.plan.max_devices}). 
              Upgrade plan untuk menambah lebih banyak device.
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b">
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-24" />
                  <div className="h-6 bg-muted animate-pulse rounded w-32" />
                  <div className="h-6 bg-muted animate-pulse rounded w-24" />
                  <div className="h-6 bg-muted animate-pulse rounded w-40" />
                </div>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between py-4 border-b">
                    <div className="h-10 bg-muted animate-pulse rounded w-32" />
                    <div className="h-10 bg-muted animate-pulse rounded w-40" />
                    <div className="h-10 bg-muted animate-pulse rounded w-24" />
                    <div className="h-10 bg-muted animate-pulse rounded w-32" />
                    <div className="h-10 bg-muted animate-pulse rounded w-24" />
                    <div className="flex gap-2">
                      <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                      <div className="h-10 w-24 bg-muted animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : devices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Smartphone className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Belum ada device</h3>
              <p className="text-muted-foreground mb-4">
                Mulai dengan menambahkan device WhatsApp pertama Anda
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Device Pertama
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile View - Swipeable Cards */}
            <div className="md:hidden space-y-3">
              {devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onConnect={handleConnectDevice}
                  onDetail={handleDetail}
                  onClearSession={handleClearSession}
                  onRelog={handleReconnect}
                  onLogout={handleLogout}
                  onDelete={handleDeleteDevice}
                  onCopyApiKey={copyToClipboard}
                  onStopConnecting={handleStopConnecting}
                  getStatusColor={getStatusColor}
                  getStatusText={getStatusText}
                />
              ))}
            </div>

            {/* Desktop View - Table */}
            <Card className="hidden md:block">
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Device</TableHead>
                      <TableHead className="font-semibold">API Key</TableHead>
                      <TableHead className="font-semibold">Server ID</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Webhook Media</TableHead>
                      <TableHead className="text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id} className="hover:bg-muted/30 transition-all duration-300 ease-in-out">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{device.device_name}</span>
                            {device.is_multidevice && (
                              <Badge className="bg-green-500 text-white w-fit text-xs transition-all duration-200">
                                Multidevice
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {device.api_key?.substring(0, 10)}...
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => copyToClipboard(device.api_key || '')}
                              title="Copy API Key"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-mono">{device.server_id || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getStatusColor(device.status)} transition-all duration-300`}>
                            {getStatusText(device.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground truncate max-w-[150px] block">
                            {device.webhook_url || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5 justify-end">
                            {device.status === "disconnected" && (
                              <Button
                                size="sm"
                                onClick={() => handleConnectDevice(device)}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-8"
                              >
                                <QrCode className="w-3 h-3 mr-1" />
                                Scan QR
                              </Button>
                            )}
                            {device.status === "connecting" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConnectDevice(device)}
                                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs h-8"
                                  title="Scan ulang/lihat kode"
                                >
                                  <QrCode className="w-3 h-3 mr-1" />
                                  Scan Ulang
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStopConnecting(device)}
                                  className="border-red-500 text-red-500 h-8"
                                  title="Batalkan & putuskan"
                                >
                                  Batal
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDetail(device)}
                              className="border-orange-500 text-orange-500 hover:bg-orange-50 h-8 w-8 p-0"
                              title="Detail"
                            >
                              <Info className="w-3 h-3" />
                            </Button>
                            {device.status === "connected" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleClearSession(device)}
                                  className="border-purple-500 text-purple-500 hover:bg-purple-50 h-8 w-8 p-0"
                                  title="Clear Session - Hapus data autentikasi"
                                >
                                  <Database className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReconnect(device)}
                                  className="border-blue-500 text-blue-500 hover:bg-blue-50 h-8 w-8 p-0"
                                  title="Reconnect - Coba koneksi ulang"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLogout(device)}
                                  className="border-orange-500 text-orange-500 hover:bg-orange-50 h-8 w-8 p-0"
                                  title="Logout - Keluar dari WhatsApp"
                                >
                                  <LogOut className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteDevice(device.id)}
                              className="bg-red-500 hover:bg-red-600 h-8 w-8 p-0"
                              title="Hapus"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </>
        )}

        {/* Connection Dialog - QR or Pairing */}
        <Dialog open={qrDialogOpen} onOpenChange={async (open) => {
          // Prevent closing if pairing code is active
          if (!open && connectionStatus === 'pairing_ready') {
            toast.info('Gunakan tombol Batal untuk menutup dialog');
            return;
          }
          
          setQrDialogOpen(open);
          if (!open) {
            if (connectionStatus !== "connected") {
              await handleCancelConnect();
              return; // handleCancelConnect will close and reset
            }
            setConnectionStatus("idle");
            setPairingPhone('');
            setConnectionMethod('qr');
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[95vh] overflow-y-auto" onPointerDownOutside={(e) => {
            // Prevent closing when clicking outside if pairing code is shown
            if (connectionStatus === 'pairing_ready' || connectionStatus === 'qr_ready') {
              e.preventDefault();
            }
          }}>
            <DialogHeader>
              <DialogTitle className="text-center text-lg sm:text-xl">
                {connectionStatus === "connected" ? "✅ Berhasil Terhubung!" : 
                 connectionStatus === "idle" ? "Pilih Metode Koneksi" :
                 selectedDevice?.connection_method === 'pairing' ? "Kode Pairing" : "Scan QR Code"}
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                {connectionStatus === "idle" && "Pilih cara menghubungkan WhatsApp"}
                {connectionStatus === "connecting" && "Menghubungkan ke server..."}
                {connectionStatus === "generating_qr" && "Membuat QR code..."}
                {connectionStatus === "generating_pairing" && "Membuat kode pairing..."}
                {connectionStatus === "qr_ready" && `QR code siap di-scan (${qrExpiry}s)`}
                {connectionStatus === "pairing_ready" && "Masukkan kode ini di WhatsApp"}
                {connectionStatus === "qr_expired" && "QR code expired"}
                {connectionStatus === "pairing_expired" && "Kode pairing expired"}
                {connectionStatus === "connected" && "WhatsApp berhasil terhubung!"}
                {connectionStatus === "error" && "Terjadi kesalahan"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center p-3 sm:p-6 space-y-3 sm:space-y-4">
              {connectionStatus === "idle" && (
                <div className="space-y-3 sm:space-y-4 w-full">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <Button
                      variant={connectionMethod === 'qr' ? 'default' : 'outline'}
                      onClick={() => setConnectionMethod('qr')}
                      className="h-20 sm:h-24 flex flex-col gap-1 sm:gap-2"
                    >
                      <QrCode className="w-6 h-6 sm:w-8 sm:h-8" />
                      <span className="text-xs sm:text-sm">QR Code</span>
                    </Button>
                    <Button
                      variant={connectionMethod === 'pairing' ? 'default' : 'outline'}
                      onClick={() => setConnectionMethod('pairing')}
                      className="h-20 sm:h-24 flex flex-col gap-1 sm:gap-2"
                    >
                      <Smartphone className="w-6 h-6 sm:w-8 sm:h-8" />
                      <span className="text-xs sm:text-sm">Kode Pairing</span>
                    </Button>
                  </div>

                   {connectionMethod === 'pairing' && (
                    <div className="space-y-2">
                      <Label htmlFor="pairingPhone" className="text-sm font-medium">Nomor WhatsApp</Label>
                      <SecureInput
                        id="pairingPhone"
                        type="tel"
                        placeholder="62812345678"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value.replace(/\D/g, ''))}
                        maxLength={20}
                        className="text-base h-11 font-mono"
                      />
                      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-2.5 rounded-md">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>Format:</strong> Nomor dengan kode negara (tanpa +)<br/>
                          <strong>Contoh:</strong> 62812345678 untuk Indonesia<br/>
                          <strong>Maksimal:</strong> 20 digit
                        </p>
                      </div>
                    </div>
                  )}

                  <Button 
                    className="w-full text-sm sm:text-base" 
                    onClick={() => {
                      if (connectionMethod === 'pairing' && !pairingPhone) {
                        toast.error('Masukkan nomor WhatsApp');
                        return;
                      }
                      if (selectedDevice) {
                        handleConnectDevice(selectedDevice, connectionMethod, pairingPhone || undefined);
                      }
                    }}
                  >
                    Hubungkan
                  </Button>
                </div>
              )}

              {connectionStatus === "connecting" && (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-12 h-12 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Menghubungkan ke server WhatsApp...</p>
                </div>
              )}
              
              {connectionStatus === "generating_qr" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Membuat QR code...</p>
                </div>
              )}

              {connectionStatus === "generating_pairing" && (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground">Membuat kode pairing...</p>
                </div>
              )}
              
              {(connectionStatus === "pairing_ready" || connectionStatus === "pairing_expired") && (
                <div className="space-y-3 sm:space-y-4 w-full">
                  {/* Pairing Code Display Card */}
                  <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 sm:p-6 rounded-xl border-2 border-green-200 dark:border-green-800">
                    <div className={`${connectionStatus === "pairing_expired" ? "opacity-30" : ""}`}>
                      <p className="text-sm sm:text-base font-semibold text-center mb-3 sm:mb-4 text-green-800 dark:text-green-200">
                        Kode Pairing Anda
                      </p>
                      
                      {/* Code Display */}
                      <div className="bg-white dark:bg-gray-900 rounded-lg p-3 sm:p-4 shadow-inner">
                        <div className="flex flex-col items-center gap-3">
                          {/* Large Code Display */}
                          <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-gray-100 font-mono tracking-[0.2em] sm:tracking-[0.3em] select-all">
                            {selectedDevice?.pairing_code ? (
                              selectedDevice.pairing_code.match(/.{1,4}/g)?.map((chunk, idx) => (
                                <span key={idx}>
                                  {idx > 0 && <span className="text-gray-400 dark:text-gray-600 mx-1 sm:mx-2">-</span>}
                                  <span className="text-green-600 dark:text-green-400">{chunk}</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500">Loading...</span>
                            )}
                          </div>
                          
                          {/* Copy Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (selectedDevice?.pairing_code) {
                                copyToClipboard(selectedDevice.pairing_code);
                                toast.success('Kode berhasil disalin!');
                              } else {
                                toast.error('Kode belum tersedia');
                              }
                            }}
                            className="border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          >
                            <Copy className="w-3 h-3 mr-1.5" />
                            Copy Kode
                          </Button>
                        </div>
                      </div>
                      
                      {/* Timer/Status */}
                      {connectionStatus === "pairing_ready" && (
                        <div className="mt-3 text-center">
                          <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            ✓ Kode aktif dan siap digunakan
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Expired Overlay */}
                    {connectionStatus === "pairing_expired" && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-red-500/10">
                        <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium shadow-lg">
                          Kode Expired
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Instructions Card */}
                  <div className="bg-gradient-to-b from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    {/* Alert */}
                    <div className="flex items-center gap-2 mb-4 p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg border border-amber-300 dark:border-amber-700">
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
                        Tidak ada notifikasi otomatis. Buka WhatsApp manual.
                      </p>
                    </div>
                    
                    {/* Steps */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                        📱 Langkah-langkah:
                      </p>
                      
                      <div className="grid gap-2">
                        {[
                          { icon: "📱", text: "Buka WhatsApp di HP" },
                          { icon: "⚙️", text: "Tap Menu/Settings" },
                          { icon: "🔗", text: 'Pilih "Linked Devices"' },
                          { icon: "➕", text: 'Tap "Link a Device"' },
                          { icon: "🔢", text: 'Pilih "Link with phone number"' },
                          { icon: "✏️", text: "Masukkan kode 8 digit" },
                          { icon: "✅", text: "Tunggu 10-30 detik", highlight: true }
                        ].map((step, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 p-2 bg-white/50 dark:bg-gray-900/50 rounded-lg hover:bg-white/80 dark:hover:bg-gray-900/80 transition-colors">
                            <div className="w-7 h-7 flex items-center justify-center bg-blue-500 text-white rounded-full text-xs font-bold shrink-0">
                              {idx + 1}
                            </div>
                            <span className="text-xs">{step.icon}</span>
                            <span className={`text-xs ${step.highlight ? 'font-semibold text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                              {step.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelConnect}
                      className="text-xs sm:text-sm border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      Batal
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleRefreshQR}
                      className="text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
                    >
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                      Refresh Kode
                    </Button>
                  </div>
                </div>
              )}

              {(connectionStatus === "qr_ready" || connectionStatus === "qr_expired") && selectedDevice?.qr_code && (
                <div className="space-y-3 sm:space-y-4 w-full">
                  <div className="relative bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-inner mx-auto w-fit">
                    <img
                      src={selectedDevice.qr_code}
                      alt="QR Code"
                      className={`w-48 h-48 sm:w-56 sm:h-56 md:w-72 md:h-72 ${connectionStatus === "qr_expired" ? "opacity-30" : ""}`}
                    />
                    {connectionStatus === "qr_expired" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-red-500 text-white px-4 py-2 sm:px-6 sm:py-3 rounded-lg text-sm sm:text-base font-medium">
                          QR Expired
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between px-2 sm:px-4 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <div className={`w-2 h-2 rounded-full ${qrExpiry > 10 ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
                      <span className="text-xs sm:text-sm font-medium">
                        {connectionStatus === "qr_expired" ? "Expired" : `Berlaku ${qrExpiry} detik`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRefreshQR}
                      className="text-xs sm:text-sm"
                    >
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Refresh QR</span>
                      <span className="sm:hidden">Refresh</span>
                    </Button>
                  </div>
                  
                  <div className="bg-muted p-3 sm:p-4 rounded-lg">
                    <p className="text-xs sm:text-sm font-medium mb-2 text-center">📱 Cara scan QR:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 sm:space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary min-w-[1rem]">1.</span>
                        <span>Buka WhatsApp di ponsel Anda</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary min-w-[1rem]">2.</span>
                        <span>Tap Menu (⋮) atau Settings (⚙️)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary min-w-[1rem]">3.</span>
                        <span>Pilih "Linked Devices"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary min-w-[1rem]">4.</span>
                        <span>Tap "Link a Device"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary min-w-[1rem]">5.</span>
                        <span>Arahkan kamera ke QR code di atas</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
              
              {connectionStatus === "connected" && (
                <div className="flex flex-col items-center gap-3 sm:gap-4 py-4 sm:py-8">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-4xl sm:text-5xl">✓</span>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-green-600">WhatsApp Terhubung!</p>
                  <p className="text-xs sm:text-sm text-muted-foreground text-center px-4">
                    Device {selectedDevice?.device_name} berhasil terhubung
                  </p>
                </div>
              )}
              
              {connectionStatus === "error" && (
                <div className="flex flex-col items-center gap-3 sm:gap-4 py-4 sm:py-8">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-4xl sm:text-5xl">✕</span>
                  </div>
                  <p className="text-base sm:text-lg font-medium text-red-600">Connection Error</p>
                  <Button onClick={handleRefreshQR} size="sm" className="text-xs sm:text-sm">
                    <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Coba Lagi
                  </Button>
                </div>
              )}

              {connectionStatus !== "connected" && connectionStatus !== "idle" && (
                <div className="flex items-center justify-center gap-2 sm:gap-3 pt-2">
                  <Button variant="outline" size="sm" onClick={handleCancelConnect} className="text-xs sm:text-sm">
                    Batal
                  </Button>
                  {(connectionStatus === "qr_ready" || connectionStatus === "qr_expired" || connectionStatus === "pairing_ready" || connectionStatus === "pairing_expired" || connectionStatus === "error") && (
                    <Button onClick={handleRefreshQR} size="sm" className="text-xs sm:text-sm">
                      <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      {selectedDevice?.connection_method === 'pairing' ? 'Refresh Kode' : 'Refresh QR'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Device Details
              </DialogTitle>
              <DialogDescription>
                Informasi lengkap dan action untuk device WhatsApp
              </DialogDescription>
            </DialogHeader>
            {selectedDevice && (
              <div className="space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Device Name</Label>
                    <p className="font-medium text-sm mt-1">{selectedDevice.device_name}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge className={getStatusColor(selectedDevice.status)}>
                        {getStatusText(selectedDevice.status)}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone Number</Label>
                    <p className="font-medium text-sm mt-1">{selectedDevice.phone_number || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Server ID</Label>
                    <p className="font-mono text-sm mt-1">{selectedDevice.server_id || '-'}</p>
                  </div>
                  {selectedDevice.last_connected_at && (
                    <div className="col-span-2">
                      <Label className="text-xs text-muted-foreground">Last Connected</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedDevice.last_connected_at).toLocaleString('id-ID', {
                          dateStyle: 'full',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* API Key Section */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">API Key</Label>
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <code className="text-xs font-mono flex-1 break-all">
                      {selectedDevice.api_key}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(selectedDevice.api_key || '')}
                      className="shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Quick Actions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedDevice.status === "disconnected" && (
                      <Button
                        onClick={() => {
                          setDetailDialogOpen(false);
                          handleConnectDevice(selectedDevice);
                        }}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Scan QR Code
                      </Button>
                    )}
                    {selectedDevice.status === "connecting" && (
                      <>
                        <Button
                          onClick={() => {
                            setDetailDialogOpen(false);
                            handleConnectDevice(selectedDevice);
                          }}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Scan Ulang
                        </Button>
                        <Button
                          onClick={() => handleStopConnecting(selectedDevice)}
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-50"
                        >
                          Batal
                        </Button>
                      </>
                    )}
                    {selectedDevice.status === "connected" && (
                      <>
                        <Button
                          onClick={() => {
                            setDetailDialogOpen(false);
                            handleClearSession(selectedDevice);
                          }}
                          variant="outline"
                          className="border-purple-500 text-purple-500 hover:bg-purple-50"
                        >
                          <Database className="w-4 h-4 mr-2" />
                          Clear Session
                        </Button>
                        <Button
                          onClick={() => {
                            setDetailDialogOpen(false);
                            handleReconnect(selectedDevice);
                          }}
                          variant="outline"
                          className="border-blue-500 text-blue-500 hover:bg-blue-50"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                        <Button
                          onClick={() => {
                            setDetailDialogOpen(false);
                            handleLogout(selectedDevice);
                          }}
                          variant="outline"
                          className="border-orange-500 text-orange-500 hover:bg-orange-50"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Logout
                        </Button>
                      </>
                    )}
                    <Button
                      onClick={() => {
                        setDetailDialogOpen(false);
                        handleDeleteDevice(selectedDevice.id);
                      }}
                      variant="destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Device
                    </Button>
                  </div>
                </div>

                {/* Additional Info */}
                {selectedDevice.is_multidevice && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      ✓ Device ini mendukung Multi-device WhatsApp
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Devices;
