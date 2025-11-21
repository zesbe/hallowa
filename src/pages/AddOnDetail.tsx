import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { useAddOns } from '@/hooks/useAddOns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Check, ArrowLeft, BookOpen, Settings, Play, Info, ExternalLink } from 'lucide-react';

export default function AddOnDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addOns, userAddOns, purchaseAddOn, isPurchasing, hasAddOn } = useAddOns();
  
  const addon = addOns.find(a => a.slug === slug);
  const isPurchased = hasAddOn(slug || '');

  if (!addon) {
    return (
      <Layout>
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => navigate('/add-ons')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Add-on not found</AlertTitle>
            <AlertDescription>
              The add-on you're looking for doesn't exist or has been removed.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const handlePurchase = async () => {
    try {
      const result = await purchaseAddOn({ addOnId: addon.id });
      
      if (result?.payment && result?.pakasir) {
        window.location.href = `/payment?type=addon&name=${encodeURIComponent(addon.name)}`;
        sessionStorage.setItem('payment_data', JSON.stringify({
          payment: result.payment,
          pakasir: result.pakasir,
          type: 'addon',
          add_on_name: addon.name
        }));
      }
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  // Documentation content based on slug
  const getDocumentation = () => {
    switch (slug) {
      case 'ai-chatbot-basic':
        return {
          overview: 'AI Chatbot Basic memungkinkan Anda membuat chatbot pintar yang dapat merespons pesan pelanggan secara otomatis menggunakan kecerdasan buatan.',
          features: [
            'Auto-reply dengan AI untuk pertanyaan umum',
            'Keyword trigger untuk respons spesifik',
            'Conversation history tracking',
            'Customizable AI prompts',
            'Multi-device support'
          ],
          setup: [
            {
              title: '1. Beli dan Aktifkan Add-on',
              description: 'Klik tombol "Buy Now" dan selesaikan pembayaran. Add-on akan otomatis aktif setelah pembayaran berhasil.'
            },
            {
              title: '2. Hubungkan Device WhatsApp',
              description: 'Pastikan Anda sudah menghubungkan device WhatsApp di halaman Devices. AI Chatbot akan bekerja pada semua device yang terhubung.'
            },
            {
              title: '3. Buat Rule Chatbot',
              description: 'Pergi ke menu AI Chatbot dan buat rule baru. Pilih trigger type (keyword atau AI) dan set respons yang diinginkan.'
            },
            {
              title: '4. Test Chatbot',
              description: 'Kirim pesan test ke nomor WhatsApp yang terhubung untuk memastikan chatbot merespons dengan benar.'
            }
          ],
          usage: [
            'Buka menu "AI Chatbot" di sidebar',
            'Klik "Create New Rule"',
            'Pilih device yang ingin digunakan',
            'Set trigger type: "keyword" untuk respons exact match, atau "ai" untuk respons AI-powered',
            'Untuk AI trigger, tulis system prompt yang menjelaskan bagaimana bot harus merespons',
            'Untuk text response, tulis template pesan yang akan dikirim',
            'Aktifkan rule dan chatbot siap digunakan',
          ],
          tips: [
            'Gunakan keyword trigger untuk pertanyaan umum yang sering ditanya',
            'Gunakan AI trigger untuk pertanyaan kompleks yang memerlukan konteks',
            'Test chatbot dengan berbagai skenario sebelum digunakan untuk pelanggan',
            'Monitor conversation history untuk improve AI prompts',
            'Set priority untuk rule yang lebih spesifik agar diproses duluan'
          ]
        };

      case 'shopify-integration':
        return {
          overview: 'Shopify Integration menghubungkan toko Shopify Anda dengan WhatsApp untuk notifikasi order otomatis, sync customer, dan update stock real-time.',
          features: [
            'Notifikasi order baru via WhatsApp',
            'Auto-sync customer ke contacts',
            'Stock alert notifications',
            'Order status updates',
            'Payment confirmation alerts'
          ],
          setup: [
            {
              title: '1. Beli dan Aktifkan Add-on',
              description: 'Pastikan Anda sudah membeli add-on Shopify Integration. Check status di My Add-ons.'
            },
            {
              title: '2. Dapatkan Shopify Credentials',
              description: 'Login ke Shopify Admin > Settings > Apps and sales channels > Develop apps > Create an app. Copy API Key dan API Secret.'
            },
            {
              title: '3. Setup Webhook Secret',
              description: 'Di Shopify Admin, buat webhook dan set URL ke endpoint yang disediakan. Copy webhook secret.'
            },
            {
              title: '4. Connect di HalloWA',
              description: 'Pergi ke menu Integrations > Shopify > Connect. Masukkan shop domain, API key, API secret, dan webhook secret.'
            },
            {
              title: '5. Pilih Device & Notify Phone',
              description: 'Pilih device WhatsApp untuk mengirim notifikasi dan masukkan nomor yang akan menerima notifikasi.'
            }
          ],
          usage: [
            'Setelah connected, webhook akan otomatis mengirim notifikasi untuk:',
            '  • Order baru (orders/create)',
            '  • Pembayaran diterima (orders/paid)',
            '  • Order fulfilled (orders/fulfilled)',
            '  • Customer baru (customers/create)',
            '  • Stock alert (products/update)',
            'Semua notifikasi akan dikirim ke nomor yang Anda set',
            'Customer otomatis di-sync ke Contacts dengan tag "shopify"',
            'Check Integration Logs untuk monitoring'
          ],
          tips: [
            'Set notify phone ke nomor tim customer service',
            'Monitor integration logs secara berkala',
            'Test webhook dengan order test di Shopify',
            'Update webhook secret secara berkala untuk keamanan',
            'Gunakan stock alert untuk restock proaktif'
          ]
        };

      case 'woocommerce-integration':
        return {
          overview: 'WooCommerce Integration menghubungkan toko WooCommerce Anda dengan WhatsApp untuk automasi notifikasi dan sync data customer.',
          features: [
            'Auto notifikasi order baru',
            'Customer sync to contacts',
            'Order completion alerts',
            'Stock monitoring',
            'Real-time webhooks'
          ],
          setup: [
            {
              title: '1. Aktifkan Add-on',
              description: 'Beli dan aktifkan WooCommerce Integration add-on terlebih dahulu.'
            },
            {
              title: '2. Install WooCommerce Webhook Plugin',
              description: 'Pastikan WooCommerce REST API aktif di WordPress Admin > WooCommerce > Settings > Advanced > REST API.'
            },
            {
              title: '3. Buat API Keys',
              description: 'Generate Consumer Key dan Consumer Secret dari WooCommerce > Settings > Advanced > REST API > Add key.'
            },
            {
              title: '4. Setup Webhook',
              description: 'Buat webhook di WooCommerce > Settings > Advanced > Webhooks. Set topic (order.created, order.paid, dll) dan delivery URL.'
            },
            {
              title: '5. Connect di HalloWA',
              description: 'Pergi ke Integrations > WooCommerce > Connect. Masukkan store URL, consumer key, consumer secret, dan webhook secret.'
            }
          ],
          usage: [
            'Webhook akan trigger untuk events:',
            '  • order.created - Notifikasi order baru',
            '  • order.completed - Order selesai',
            '  • customer.created - Customer baru',
            '  • product.updated - Update stock',
            'Notifikasi termasuk detail order, customer info, dan items',
            'Customer auto-sync dengan billing info lengkap',
            'Integration logs tersedia untuk troubleshooting'
          ],
          tips: [
            'Test webhook dengan WooCommerce Webhook Tester',
            'Regenerate API keys secara berkala',
            'Monitor failed webhooks di integration logs',
            'Set up multiple webhooks untuk berbagai events',
            'Backup webhook secrets di tempat aman'
          ]
        };

      case 'google-sheets-integration':
        return {
          overview: 'Google Sheets Integration memungkinkan sync contacts, broadcasts, dan message history ke Google Sheets untuk analisis data lebih mudah.',
          features: [
            'Auto-sync contacts to Sheets',
            'Broadcast history export',
            'Message logs tracking',
            'Real-time data sync',
            'Custom mapping fields'
          ],
          setup: [
            {
              title: '1. Buat Google Cloud Project',
              description: 'Pergi ke Google Cloud Console, buat project baru, dan enable Google Sheets API.'
            },
            {
              title: '2. Buat Service Account',
              description: 'Di IAM & Admin > Service Accounts, buat service account baru dan download JSON key file.'
            },
            {
              title: '3. Share Google Sheet',
              description: 'Buat Google Sheet baru dan share ke service account email dengan edit access.'
            },
            {
              title: '4. Connect di HalloWA',
              description: 'Pergi ke Integrations > Google Sheets > Connect. Upload service account JSON dan masukkan Sheet ID.'
            },
            {
              title: '5. Setup Sync Schedule',
              description: 'Pilih data yang ingin di-sync (contacts, broadcasts, messages) dan set sync frequency.'
            }
          ],
          usage: [
            'Setelah connected, data akan auto-sync sesuai schedule',
            'Manual sync tersedia via "Sync Now" button',
            'Data akan ditambahkan ke sheet dengan columns:',
            '  • Contacts: Name, Phone, Tags, Created Date',
            '  • Broadcasts: Name, Status, Sent/Failed Count',
            '  • Messages: Phone, Content, Timestamp, Type',
            'Check last sync status di integration logs'
          ],
          tips: [
            'Jangan edit column headers di Sheet',
            'Backup Sheet secara berkala',
            'Use Sheet filters dan pivot tables untuk analisis',
            'Set sync frequency sesuai kebutuhan (jangan terlalu sering)',
            'Monitor quota usage di Google Cloud Console'
          ]
        };

      default:
        return {
          overview: addon.description || 'No description available.',
          features: Array.isArray(addon.features) ? addon.features : [],
          setup: [],
          usage: [],
          tips: []
        };
    }
  };

  const docs = getDocumentation();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <Button variant="ghost" onClick={() => navigate('/add-ons')} className="mb-2 -ml-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Marketplace
            </Button>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{addon.name}</h1>
              {isPurchased && (
                <Badge variant="default" className="gap-1">
                  <Check className="w-3 h-3" />
                  Owned
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-lg">{addon.description}</p>
          </div>
          
          {!isPurchased && (
            <Card className="w-72">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-3xl font-bold">
                      Rp {parseInt(addon.price.toString()).toLocaleString('id-ID')}
                    </p>
                    <p className="text-sm text-muted-foreground">one-time payment</p>
                  </div>
                  <Button 
                    onClick={handlePurchase} 
                    disabled={isPurchasing}
                    className="w-full"
                    size="lg"
                  >
                    {isPurchasing ? 'Processing...' : 'Buy Now'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Info className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="setup" className="gap-2">
              <Settings className="w-4 h-4" />
              Setup Guide
            </TabsTrigger>
            <TabsTrigger value="usage" className="gap-2">
              <Play className="w-4 h-4" />
              How to Use
            </TabsTrigger>
            <TabsTrigger value="tips" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Tips & Best Practices
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>About This Add-on</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{docs.overview}</p>
                
                <div>
                  <h3 className="font-semibold mb-3">Key Features</h3>
                  <ul className="space-y-2">
                    {docs.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Setup Tab */}
          <TabsContent value="setup" className="space-y-4">
            {docs.setup.map((step, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-lg">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>How to Use</CardTitle>
                <CardDescription>Step-by-step guide untuk menggunakan add-on ini</CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3 list-decimal list-inside">
                  {docs.usage.map((step, idx) => (
                    <li key={idx} className="text-muted-foreground">{step}</li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips" className="space-y-4">
            <Alert>
              <BookOpen className="h-4 w-4" />
              <AlertTitle>Pro Tips</AlertTitle>
              <AlertDescription>
                Follow these best practices to get the most out of this add-on
              </AlertDescription>
            </Alert>

            <Card>
              <CardContent className="pt-6">
                <ul className="space-y-3">
                  {docs.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                      </div>
                      <span className="text-muted-foreground">{tip}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Support */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5" />
              Need Help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Jika Anda mengalami kesulitan atau punya pertanyaan, hubungi tim support kami.
            </p>
            <Button variant="outline">
              Contact Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
