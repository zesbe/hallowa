import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, BookOpen, Code, Send, Users, MessageSquare, Zap, CheckCircle2, Key } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast.success("Kode berhasil disalin!");
  };

  return (
    <div className="relative group">
      <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        <Copy className="w-4 h-4" />
      </Button>
    </div>
  );
};

const EndpointCard = ({ 
  method, 
  endpoint, 
  description, 
  parameters, 
  response,
  example 
}: { 
  method: string; 
  endpoint: string; 
  description: string;
  parameters?: Array<{ name: string; type: string; required: boolean; description: string }>;
  response?: string;
  example?: string;
}) => {
  const methodColors = {
    GET: "bg-green-500",
    POST: "bg-blue-500",
    PUT: "bg-yellow-500",
    DELETE: "bg-red-500",
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-start gap-3">
          <Badge className={`${methodColors[method as keyof typeof methodColors]} text-white`}>
            {method}
          </Badge>
          <div className="flex-1">
            <code className="text-sm bg-muted px-2 py-1 rounded">{endpoint}</code>
            <p className="text-sm text-muted-foreground mt-2">{description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {parameters && parameters.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Parameters</h4>
            <div className="space-y-2">
              {parameters.map((param, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <code className="bg-muted px-2 py-0.5 rounded">{param.name}</code>
                  <Badge variant="outline" className="text-xs">{param.type}</Badge>
                  {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                  <span className="text-muted-foreground">- {param.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {response && (
          <div>
            <h4 className="font-semibold mb-2">Response</h4>
            <CodeBlock code={response} language="json" />
          </div>
        )}
        
        {example && (
          <div>
            <h4 className="font-semibold mb-2">Example Request</h4>
            <CodeBlock code={example} />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function ApiDocs() {
  const baseUrl = "https://ierdfxgeectqoekugyvb.supabase.co/functions/v1";
  
  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground mb-2">
              Dokumentasi API HalloWa
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Panduan lengkap untuk mengintegrasikan HalloWa WhatsApp Bot Marketing dengan aplikasi Anda
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-primary to-secondary text-white">
            v2.0
          </Badge>
        </div>

        {/* Quick Start Guide */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Quick Start
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Generate API Key</h4>
                  <p className="text-xs text-muted-foreground">Buat API key di halaman Settings atau API Keys</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Setup Authentication</h4>
                  <p className="text-xs text-muted-foreground">Tambahkan API key ke header request</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Start Integration</h4>
                  <p className="text-xs text-muted-foreground">Mulai kirim request ke endpoint API</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication Section */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
            <CardDescription>HalloWa mendukung 2 jenis API Key untuk keamanan maksimal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  1. Account API Key (User Level)
                </h4>
                <p className="text-sm mb-3">
                  API key yang di-generate dari halaman API Keys. Digunakan untuk autentikasi tingkat akun dengan akses penuh ke semua device dan data Anda.
                </p>
                <CodeBlock code={`Authorization: Bearer YOUR_ACCOUNT_API_KEY
Content-Type: application/json`} />
                <p className="text-xs text-muted-foreground mt-2">
                  Gunakan untuk: Manajemen device, contacts, broadcasts, dan fitur tingkat akun lainnya
                </p>
              </div>

              <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  2. Device API Key (Device Level)
                </h4>
                <p className="text-sm mb-3">
                  API key unik untuk setiap device WhatsApp. Digunakan untuk autentikasi spesifik device dengan akses terbatas hanya untuk device tersebut.
                </p>
                <CodeBlock code={`x-api-key: YOUR_DEVICE_API_KEY
Content-Type: application/json`} />
                <p className="text-xs text-muted-foreground mt-2">
                  Gunakan untuk: Kirim pesan, cek status device tertentu (lebih aman untuk dibagikan ke tim)
                </p>
                <p className="text-xs text-muted-foreground mt-2 font-semibold">
                  📍 Device API Key tersedia di Device Details &gt; API Key pada setiap device
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                ⚠️ <strong>Penting:</strong> Jangan pernah share API key Anda atau commit ke repository publik. Simpan dengan aman di environment variables.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints Tabs */}
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 h-auto">
            <TabsTrigger value="messages" className="gap-2">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="broadcasts" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Broadcasts</span>
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-2">
              <Code className="w-4 h-4" />
              <span className="hidden sm:inline">Devices</span>
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Webhooks</span>
            </TabsTrigger>
          </TabsList>

          {/* Messages API */}
          <TabsContent value="messages" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Messages API</h2>
              <p className="text-muted-foreground">Endpoint untuk mengirim pesan WhatsApp</p>
            </div>

            <EndpointCard
              method="POST"
              endpoint="/api-send-message/send-message"
              description="Kirim pesan teks ke satu atau lebih nomor WhatsApp"
              parameters={[
                { name: "to", type: "string", required: true, description: "Nomor tujuan (format: 628xxx)" },
                { name: "message", type: "string", required: true, description: "Isi pesan yang akan dikirim" },
                { name: "delay", type: "number", required: false, description: "Delay dalam detik (default: 0)" },
              ]}
              response={`{
  "success": true,
  "message": "Pesan berhasil dikirim",
  "data": {
    "message_id": "msg_123456",
    "status": "queued",
    "timestamp": "2025-11-02T10:30:00Z"
  }
}`}
              example={`curl -X POST ${baseUrl}/api-send-message/send-message \\
  -H "x-api-key: YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "628123456789",
    "message": "Halo! Ini pesan dari API HalloWa"
  }'`}
            />

            <EndpointCard
              method="POST"
              endpoint="/api-send-message/send-media"
              description="Kirim pesan dengan media (gambar, video, dokumen)"
              parameters={[
                { name: "to", type: "string", required: true, description: "Nomor tujuan" },
                { name: "media_url", type: "string", required: true, description: "URL media yang akan dikirim" },
                { name: "caption", type: "string", required: false, description: "Caption untuk media" },
                { name: "media_type", type: "string", required: true, description: "Tipe media: image, video, document" },
              ]}
              response={`{
  "success": true,
  "message": "Media berhasil dikirim",
  "data": {
    "message_id": "msg_789012",
    "media_id": "media_345"
  }
}`}
              example={`curl -X POST ${baseUrl}/api-send-message/send-media \\
  -H "x-api-key: YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "628123456789",
    "media_url": "https://example.com/image.jpg",
    "caption": "Lihat gambar ini!",
    "media_type": "image"
  }'`}
            />
          </TabsContent>

          {/* Contacts API */}
          <TabsContent value="contacts" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Contacts API</h2>
              <p className="text-muted-foreground">Endpoint untuk mengelola kontak</p>
            </div>

            <EndpointCard
              method="GET"
              endpoint="/api-contacts"
              description="Ambil daftar semua kontak"
              parameters={[
                { name: "is_group", type: "boolean", required: false, description: "Filter berdasarkan tipe (true=grup, false=individu)" },
                { name: "limit", type: "number", required: false, description: "Jumlah data per halaman (default: 100)" },
              ]}
              response={`{
  "success": true,
  "data": [
    {
      "id": "contact_123",
      "name": "John Doe",
      "phone_number": "628123456789",
      "is_group": false,
      "tags": ["customer", "vip"],
      "created_at": "2025-01-20T08:00:00Z"
    }
  ],
  "count": 1
}`}
              example={`curl -X GET "${baseUrl}/api-contacts?is_group=false" \\
  -H "Authorization: Bearer YOUR_ACCOUNT_API_KEY"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/api-contacts"
              description="Tambah kontak baru"
              parameters={[
                { name: "name", type: "string", required: true, description: "Nama kontak" },
                { name: "phone_number", type: "string", required: true, description: "Nomor telepon (format: 628xxx)" },
                { name: "is_group", type: "boolean", required: false, description: "Apakah ini grup (default: false)" },
                { name: "tags", type: "array", required: false, description: "Array tag untuk kontak" },
              ]}
              response={`{
  "success": true,
  "data": {
    "id": "contact_456",
    "name": "Jane Smith",
    "phone_number": "628987654321",
    "created_at": "2025-11-02T10:35:00Z"
  }
}`}
              example={`curl -X POST ${baseUrl}/api-contacts \\
  -H "Authorization: Bearer YOUR_ACCOUNT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Jane Smith",
    "phone_number": "628987654321",
    "tags": ["customer", "new"]
  }'`}
            />

            <EndpointCard
              method="DELETE"
              endpoint="/api-contacts/{contact_id}"
              description="Hapus kontak"
              parameters={[
                { name: "contact_id", type: "string", required: true, description: "ID kontak yang akan dihapus" },
              ]}
              response={`{
  "success": true,
  "message": "Kontak berhasil dihapus"
}`}
              example={`curl -X DELETE "${baseUrl}/api-contacts/contact_123" \\
  -H "Authorization: Bearer YOUR_ACCOUNT_API_KEY"`}
            />
          </TabsContent>

          {/* Broadcasts API */}
          <TabsContent value="broadcasts" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Broadcasts API</h2>
              <p className="text-muted-foreground">Endpoint untuk mengelola broadcast campaign</p>
            </div>

            <EndpointCard
              method="POST"
              endpoint="/api-broadcasts"
              description="Buat broadcast baru"
              parameters={[
                { name: "name", type: "string", required: true, description: "Nama broadcast" },
                { name: "message", type: "string", required: true, description: "Isi pesan broadcast" },
                { name: "target_contacts", type: "array", required: true, description: "Array nomor telepon tujuan" },
                { name: "device_id", type: "string", required: false, description: "ID device (required jika pakai Account API Key)" },
                { name: "scheduled_at", type: "datetime", required: false, description: "Waktu terjadwal (ISO 8601)" },
                { name: "delay_seconds", type: "number", required: false, description: "Delay antar pesan (default: 5)" },
              ]}
              response={`{
  "success": true,
  "data": {
    "id": "broadcast_789",
    "name": "Promo Akhir Tahun",
    "status": "draft",
    "target_count": 150,
    "created_at": "2025-11-02T10:40:00Z"
  }
}`}
              example={`curl -X POST ${baseUrl}/api-broadcasts \\
  -H "x-api-key: YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Promo Akhir Tahun",
    "message": "Diskon 50% untuk semua produk!",
    "target_contacts": ["628123456789", "628987654321"]
  }'`}
            />

            <EndpointCard
              method="GET"
              endpoint="/api-broadcasts"
              description="Ambil daftar broadcast"
              parameters={[
                { name: "status", type: "string", required: false, description: "Filter by status: draft, processing, completed" },
              ]}
              response={`{
  "success": true,
  "data": [
    {
      "id": "broadcast_789",
      "name": "Promo Akhir Tahun",
      "status": "completed",
      "sent_count": 148,
      "failed_count": 2,
      "created_at": "2025-11-02T10:40:00Z"
    }
  ]
}`}
              example={`curl -X GET "${baseUrl}/api-broadcasts?status=completed" \\
  -H "Authorization: Bearer YOUR_ACCOUNT_API_KEY"`}
            />
          </TabsContent>

          {/* Devices API */}
          <TabsContent value="devices" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Devices API</h2>
              <p className="text-muted-foreground">Endpoint untuk mengelola device WhatsApp</p>
            </div>

            <EndpointCard
              method="GET"
              endpoint="/api-device-management"
              description="Ambil daftar semua device WhatsApp"
              response={`{
  "success": true,
  "data": [
    {
      "id": "device_123",
      "device_name": "WhatsApp Bisnis 1",
      "status": "connected",
      "phone_number": "628123456789",
      "api_key": "w93km47effr35ji44odupxyr1wfh3lxs",
      "webhook_url": "https://yourapp.com/webhook",
      "created_at": "2025-11-02T10:00:00Z",
      "last_connected_at": "2025-11-02T10:30:00Z"
    }
  ],
  "count": 1
}`}
              example={`curl -X GET ${baseUrl}/api-device-management \\
  -H "x-api-key: YOUR_DEVICE_API_KEY"`}
            />

            <EndpointCard
              method="GET"
              endpoint="/api-device-management/{device_id}"
              description="Dapatkan detail device tertentu"
              parameters={[
                { name: "device_id", type: "string", required: true, description: "ID device yang ingin diambil" },
              ]}
              response={`{
  "success": true,
  "data": {
    "id": "device_123",
    "device_name": "WhatsApp Bisnis 1",
    "status": "connected",
    "phone_number": "628123456789",
    "api_key": "w93km47effr35ji44odupxyr1wfh3lxs",
    "webhook_url": "https://yourapp.com/webhook",
    "session_data": { ... },
    "created_at": "2025-11-02T10:00:00Z"
  }
}`}
              example={`curl -X GET ${baseUrl}/api-device-management/device_123 \\
  -H "x-api-key: YOUR_DEVICE_API_KEY"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/api-device-management"
              description="Buat device WhatsApp baru"
              parameters={[
                { name: "device_name", type: "string", required: true, description: "Nama device" },
                { name: "webhook_url", type: "string", required: false, description: "URL webhook untuk notifikasi" },
              ]}
              response={`{
  "success": true,
  "data": {
    "id": "device_456",
    "device_name": "WhatsApp Bisnis 2",
    "api_key": "auto_generated_device_api_key",
    "status": "disconnected",
    "created_at": "2025-11-02T11:00:00Z"
  }
}`}
              example={`curl -X POST ${baseUrl}/api-device-management \\
  -H "x-api-key: YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_name": "WhatsApp Bisnis 2",
    "webhook_url": "https://yourapp.com/webhook"
  }'`}
            />

            <EndpointCard
              method="PUT"
              endpoint="/api-device-management/{device_id}"
              description="Update device WhatsApp"
              parameters={[
                { name: "device_id", type: "string", required: true, description: "ID device yang akan diupdate" },
                { name: "device_name", type: "string", required: false, description: "Nama device baru" },
                { name: "webhook_url", type: "string", required: false, description: "URL webhook baru" },
              ]}
              response={`{
  "success": true,
  "data": {
    "id": "device_123",
    "device_name": "WhatsApp Bisnis Updated",
    "webhook_url": "https://newurl.com/webhook",
    "updated_at": "2025-11-02T11:30:00Z"
  }
}`}
              example={`curl -X PUT ${baseUrl}/api-device-management/device_123 \\
  -H "x-api-key: YOUR_DEVICE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_name": "WhatsApp Bisnis Updated"
  }'`}
            />

            <EndpointCard
              method="DELETE"
              endpoint="/api-device-management/{device_id}"
              description="Hapus device WhatsApp secara aman dengan cleanup lengkap"
              parameters={[
                { name: "device_id", type: "string", required: true, description: "ID device yang akan dihapus" },
              ]}
              response={`{
  "success": true,
  "message": "Device deleted successfully",
  "details": {
    "preserved": {
      "broadcasts": "preserved as history",
      "contacts": "unlinked but preserved"
    }
  }
}`}
              example={`curl -X DELETE ${baseUrl}/api-device-management/device_123 \\
  -H "x-api-key: YOUR_DEVICE_API_KEY"`}
            />

            <EndpointCard
              method="POST"
              endpoint="/api-device-management/{device_id}/logout"
              description="Logout device WhatsApp (hapus session)"
              parameters={[
                { name: "device_id", type: "string", required: true, description: "ID device yang akan di-logout" },
              ]}
              response={`{
  "success": true,
  "message": "Device logged out successfully",
  "data": {
    "id": "device_123",
    "status": "disconnected",
    "phone_number": null
  }
}`}
              example={`curl -X POST ${baseUrl}/api-device-management/device_123/logout \\
  -H "x-api-key: YOUR_DEVICE_API_KEY"`}
            />
          </TabsContent>

          {/* Webhooks */}
          <TabsContent value="webhooks" className="space-y-6 mt-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Webhooks</h2>
              <p className="text-muted-foreground">Terima notifikasi real-time dari WhatsApp</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Setup Webhook</CardTitle>
                <CardDescription>Konfigurasi webhook untuk menerima event dari WhatsApp</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm">
                  Atur URL webhook Anda di halaman Webhooks. HalloWa akan mengirim POST request ke URL tersebut ketika ada event.
                </p>
                
                <div>
                  <h4 className="font-semibold mb-2">Event Types</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <code className="text-sm">message.received</code>
                      <span className="text-sm text-muted-foreground">- Pesan masuk diterima</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <code className="text-sm">message.sent</code>
                      <span className="text-sm text-muted-foreground">- Pesan berhasil terkirim</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <code className="text-sm">message.failed</code>
                      <span className="text-sm text-muted-foreground">- Pesan gagal terkirim</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <code className="text-sm">device.connected</code>
                      <span className="text-sm text-muted-foreground">- Device terhubung</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <code className="text-sm">device.disconnected</code>
                      <span className="text-sm text-muted-foreground">- Device terputus</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Webhook Payload Example</h4>
                  <CodeBlock code={`{
  "event": "message.received",
  "timestamp": "2025-01-28T10:45:00Z",
  "device_id": "device_123",
  "data": {
    "message_id": "msg_456",
    "from": "628123456789",
    "message": "Halo, apa kabar?",
    "media": null,
    "timestamp": "2025-01-28T10:44:55Z"
  }
}`} language="json" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Error Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Error Codes</CardTitle>
            <CardDescription>Daftar kode error yang mungkin Anda temui</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3">
                <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-mono text-sm">
                  400
                </code>
                <div>
                  <p className="font-semibold text-sm">Bad Request</p>
                  <p className="text-sm text-muted-foreground">Parameter request tidak valid atau tidak lengkap</p>
                </div>
              </div>
              <div className="flex gap-3">
                <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-mono text-sm">
                  401
                </code>
                <div>
                  <p className="font-semibold text-sm">Unauthorized</p>
                  <p className="text-sm text-muted-foreground">API key tidak valid atau tidak ada</p>
                </div>
              </div>
              <div className="flex gap-3">
                <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-mono text-sm">
                  404
                </code>
                <div>
                  <p className="font-semibold text-sm">Not Found</p>
                  <p className="text-sm text-muted-foreground">Resource tidak ditemukan</p>
                </div>
              </div>
              <div className="flex gap-3">
                <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-mono text-sm">
                  429
                </code>
                <div>
                  <p className="font-semibold text-sm">Too Many Requests</p>
                  <p className="text-sm text-muted-foreground">Rate limit terlampaui, tunggu beberapa saat</p>
                </div>
              </div>
              <div className="flex gap-3">
                <code className="bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-1 rounded font-mono text-sm">
                  500
                </code>
                <div>
                  <p className="font-semibold text-sm">Internal Server Error</p>
                  <p className="text-sm text-muted-foreground">Terjadi kesalahan di server</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>API WAPANELS menerapkan rate limiting untuk menjaga stabilitas sistem:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                <li><strong>100 requests per minute</strong> per API key</li>
                <li><strong>1000 requests per hour</strong> per API key</li>
                <li><strong>10,000 requests per day</strong> per API key</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                Header response akan menyertakan informasi rate limit:
              </p>
              <CodeBlock code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706438400`} />
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardContent className="py-6">
            <div className="text-center space-y-2">
              <BookOpen className="w-12 h-12 mx-auto text-primary" />
              <h3 className="text-xl font-bold">Butuh Bantuan?</h3>
              <p className="text-muted-foreground">
                Hubungi tim support kami jika Anda memiliki pertanyaan atau kendala
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat Support
                </Button>
                <Button variant="outline">Email Support</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
