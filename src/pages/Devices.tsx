import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Smartphone, QrCode, Trash2, RefreshCw, Copy, LogOut, Info, RotateCcw, Database, Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSwipeable } from "react-swipeable";
import { 
  requestNotificationPermission, 
  notifyDeviceConnected, 
  notifyDeviceDisconnected,
  notifyDeviceError 
} from "@/utils/notifications";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
  api_key: string | null;
  server_id: string | null;
  webhook_url: string | null;
  is_multidevice: boolean;
}

export const Devices = () => {
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

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(granted => {
      setNotificationsEnabled(granted);
    });
  }, []);

  useEffect(() => {
    fetchDevices();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('devices-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'devices'
        },
        (payload) => {
          console.log('Device update:', payload);
          fetchDevices();
          
          // Send notifications for device status changes
          if (payload.eventType === 'UPDATE' && notificationsEnabled) {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            const deviceName = payload.new?.device_name;
            
            if (oldStatus !== newStatus && deviceName) {
              if (newStatus === 'connected') {
                notifyDeviceConnected(deviceName);
              } else if (newStatus === 'disconnected' && oldStatus === 'connected') {
                notifyDeviceDisconnected(deviceName);
              } else if (newStatus === 'error') {
                notifyDeviceError(deviceName);
              }
            }
          }
          
          // Auto-close dialog when connected
          if (payload.eventType === 'UPDATE' && payload.new?.status === 'connected') {
            setTimeout(() => {
              setQrDialogOpen(false);
              setConnectionStatus("idle");
            }, 1500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, []);

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
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("devices").insert({
        user_id: user.id,
        device_name: deviceName,
        status: "disconnected",
      });

      if (error) throw error;

      toast.success("Device berhasil ditambahkan");
      setDeviceName("");
      setDialogOpen(false);
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleConnectDevice = async (device: Device) => {
    setSelectedDevice(device);
    setQrDialogOpen(true);
    setConnectionStatus("connecting");
    setQrExpiry(60);
    
    try {
      // Clear existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      
      // Update device status to 'connecting' - Railway service will detect this
      const { error } = await supabase
        .from("devices")
        .update({ 
          status: "connecting",
          qr_code: null 
        })
        .eq("id", device.id);

      if (error) throw error;

      setConnectionStatus("generating_qr");
      toast.info("Menghubungkan ke WhatsApp...");

      // Poll database for QR code updates from Railway service
      const interval = setInterval(async () => {
        const { data, error } = await supabase
          .from("devices")
          .select("*")
          .eq("id", device.id)
          .single();

        if (error) {
          console.error("Polling error:", error);
          return;
        }

        if (data) {
          // Update selected device with latest data
          setSelectedDevice(data);

          // Check for QR code
          if (data.qr_code && data.status === "connecting") {
            setConnectionStatus("qr_ready");
            setQrExpiry(60);
            toast.success("QR Code siap! Scan sekarang");
          }

          // Check if connected
          if (data.status === "connected") {
            setConnectionStatus("connected");
            toast.success("WhatsApp berhasil terhubung!");
            clearInterval(interval);
            setPollingInterval(null);
            fetchDevices();
            setTimeout(() => {
              setQrDialogOpen(false);
              setConnectionStatus("idle");
            }, 1500);
          }

          // Check for error
          if (data.status === "error") {
            setConnectionStatus("error");
            toast.error("Connection error. Silakan coba lagi.");
            clearInterval(interval);
            setPollingInterval(null);
          }
        }
      }, 2000); // Poll every 2 seconds

      setPollingInterval(interval);

      // Auto-stop polling after 5 minutes
      setTimeout(async () => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
          if (connectionStatus !== "connected") {
            setConnectionStatus("qr_expired");
            toast.error("QR Code expired. Silakan coba lagi.");
            if (selectedDevice) {
              await supabase
                .from("devices")
                .update({ status: "disconnected", qr_code: null })
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
      // Reconnect
      handleConnectDevice(selectedDevice);
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
        .update({ status: "disconnected", qr_code: null })
        .eq("id", selectedDevice.id);
    } catch (e) {
      console.error("Cancel connect error:", e);
    } finally {
      setConnectionStatus("idle");
      setQrDialogOpen(false);
    }
  };
  const handleClearSession = async (device: Device) => {
    if (!confirm("Yakin ingin menghapus session data? Device akan disconnect.")) return;

    try {
      await supabase
        .from("devices")
        .update({ 
          session_data: null,
          qr_code: null,
          status: "disconnected"
        })
        .eq("id", device.id);

      toast.success("Session data berhasil dihapus");
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLogout = async (device: Device) => {
    if (!confirm("Yakin ingin logout dari device ini?")) return;

    try {
      await supabase
        .from("devices")
        .update({ 
          status: "disconnected",
          phone_number: null,
          qr_code: null
        })
        .eq("id", device.id);

      toast.success("Device logged out successfully");
      fetchDevices();
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
      fetchDevices();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const handleRelog = (device: Device) => {
    handleLogout(device);
    setTimeout(() => handleConnectDevice(device), 1000);
  };

  const handleDetail = (device: Device) => {
    setSelectedDevice(device);
    setDetailDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500 text-white";
      case "connecting":
        return "bg-yellow-500 text-white";
      default:
        return "bg-red-500 text-white";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Terkoneksi";
      case "connecting":
        return "Connecting...";
      default:
        return "Tidak Terkoneksi";
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Device Management</h1>
            <p className="text-muted-foreground">
              Kelola semua perangkat WhatsApp yang terhubung
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={notificationsEnabled ? "default" : "outline"}
              size="icon"
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
                <Button className="bg-gradient-to-r from-primary to-secondary text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Device
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
                    <Input
                      id="deviceName"
                      value={deviceName}
                      onChange={(e) => setDeviceName(e.target.value)}
                      placeholder="Contoh: WhatsApp Bisnis 1"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Buat Device</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

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
          <Card>
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
                      <TableRow key={device.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{device.device_name}</span>
                            {device.is_multidevice && (
                              <Badge className="bg-green-500 text-white w-fit text-xs">
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
                          <Badge className={getStatusColor(device.status)}>
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
                                  title="Clear Session"
                                >
                                  <Database className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRelog(device)}
                                  className="border-pink-500 text-pink-500 hover:bg-pink-50 h-8 w-8 p-0"
                                  title="Relog"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleLogout(device)}
                                  className="border-blue-500 text-blue-500 hover:bg-blue-50 h-8 w-8 p-0"
                                  title="Logout"
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
        )}

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={async (open) => {
          setQrDialogOpen(open);
          if (!open) {
            if (connectionStatus !== "connected") {
              await handleCancelConnect();
              return; // handleCancelConnect will close and reset
            }
            setConnectionStatus("idle");
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                {connectionStatus === "connected" ? "✅ Berhasil Terhubung!" : "Scan QR Code"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {connectionStatus === "connecting" && "Menghubungkan ke server..."}
                {connectionStatus === "generating_qr" && "Membuat QR code..."}
                {connectionStatus === "qr_ready" && `QR code siap di-scan (${qrExpiry}s)`}
                {connectionStatus === "qr_expired" && "QR code expired"}
                {connectionStatus === "connected" && "WhatsApp berhasil terhubung!"}
                {connectionStatus === "error" && "Terjadi kesalahan"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col items-center justify-center p-6 space-y-4">
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
              
              {(connectionStatus === "qr_ready" || connectionStatus === "qr_expired") && selectedDevice?.qr_code && (
                <div className="space-y-4 w-full">
                  <div className="relative bg-white p-4 rounded-lg shadow-inner mx-auto w-fit">
                    <img
                      src={selectedDevice.qr_code}
                      alt="QR Code"
                      className={`w-72 h-72 ${connectionStatus === "qr_expired" ? "opacity-30" : ""}`}
                    />
                    {connectionStatus === "qr_expired" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-medium">
                          QR Expired
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${qrExpiry > 10 ? "bg-green-500" : "bg-red-500"} animate-pulse`} />
                      <span className="text-sm font-medium">
                        {connectionStatus === "qr_expired" ? "Expired" : `Berlaku ${qrExpiry} detik`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRefreshQR}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh QR
                    </Button>
                  </div>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm font-medium mb-2 text-center">📱 Cara scan QR:</p>
                    <ol className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary">1.</span>
                        <span>Buka WhatsApp di ponsel Anda</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary">2.</span>
                        <span>Tap Menu (⋮) atau Settings (⚙️)</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary">3.</span>
                        <span>Pilih "Linked Devices"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary">4.</span>
                        <span>Tap "Link a Device"</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="font-bold text-primary">5.</span>
                        <span>Arahkan kamera ke QR code di atas</span>
                      </li>
                    </ol>
                  </div>
                </div>
              )}
              
              {connectionStatus === "connected" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-5xl">✓</span>
                  </div>
                  <p className="text-lg font-medium text-green-600">WhatsApp Terhubung!</p>
                  <p className="text-sm text-muted-foreground text-center">
                    Device {selectedDevice?.device_name} berhasil terhubung
                  </p>
                </div>
              )}
              
              {connectionStatus === "error" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                    <span className="text-5xl">✕</span>
                  </div>
                  <p className="text-lg font-medium text-red-600">Connection Error</p>
                  <Button onClick={handleRefreshQR}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Coba Lagi
                  </Button>
                </div>
              )}

              {connectionStatus !== "connected" && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="outline" onClick={handleCancelConnect}>Batal</Button>
                  {(connectionStatus === "qr_ready" || connectionStatus === "qr_expired" || connectionStatus === "error") && (
                    <Button onClick={handleRefreshQR}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh QR
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
                            handleRelog(selectedDevice);
                          }}
                          variant="outline"
                          className="border-pink-500 text-pink-500 hover:bg-pink-50"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Reconnect
                        </Button>
                        <Button
                          onClick={() => {
                            setDetailDialogOpen(false);
                            handleLogout(selectedDevice);
                          }}
                          variant="outline"
                          className="border-blue-500 text-blue-500 hover:bg-blue-50"
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
