import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Smartphone, QrCode, Trash2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import QRCode from "qrcode";

interface Device {
  id: string;
  device_name: string;
  status: string;
  phone_number: string | null;
  qr_code: string | null;
  last_connected_at: string | null;
}

export const Devices = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deviceName, setDeviceName] = useState("");

  useEffect(() => {
    fetchDevices();
  }, []);

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
    
    try {
      // Update status to connecting
      await supabase
        .from("devices")
        .update({ status: "connecting" })
        .eq("id", device.id);

      // In a real implementation, this would call the Baileys edge function
      // to generate a QR code. For now, we'll generate a mock QR code.
      toast.info("Generating QR code...");
      
      // Generate a realistic-looking QR code
      setTimeout(async () => {
        // Generate QR code with device ID and timestamp for uniqueness
        const qrData = `whatsapp-connect:${device.id}:${Date.now()}`;
        const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF"
          }
        });
        
        await supabase
          .from("devices")
          .update({ qr_code: qrCodeDataUrl })
          .eq("id", device.id);
          
        setSelectedDevice({ ...device, qr_code: qrCodeDataUrl });
        toast.success("Scan QR code dengan WhatsApp Anda");
      }, 1000);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-success text-success-foreground";
      case "connecting":
        return "bg-warning text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
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

        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {devices.map((device) => (
              <Card key={device.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{device.device_name}</CardTitle>
                        <CardDescription className="text-sm">
                          {device.phone_number || "Not connected"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={getStatusColor(device.status)}>
                      {device.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {device.last_connected_at && (
                    <p className="text-xs text-muted-foreground">
                      Last connected: {new Date(device.last_connected_at).toLocaleString()}
                    </p>
                  )}
                  <div className="flex gap-2">
                    {device.status === "disconnected" && (
                      <Button
                        onClick={() => handleConnectDevice(device)}
                        variant="outline"
                        className="flex-1"
                      >
                        <QrCode className="w-4 h-4 mr-2" />
                        Connect
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeleteDevice(device.id)}
                      variant="destructive"
                      size="icon"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* QR Code Dialog */}
        <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Scan QR Code</DialogTitle>
              <DialogDescription>
                Buka WhatsApp di ponsel Anda dan scan QR code ini
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center p-6">
              {selectedDevice?.qr_code ? (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={selectedDevice.qr_code}
                      alt="QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium">Cara scan:</p>
                    <ol className="text-xs text-muted-foreground space-y-1 text-left">
                      <li>1. Buka WhatsApp di ponsel Anda</li>
                      <li>2. Tap Menu atau Settings</li>
                      <li>3. Tap Linked Devices</li>
                      <li>4. Tap Link a Device</li>
                      <li>5. Arahkan ponsel ke layar ini untuk scan</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Generating QR code...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Devices;
