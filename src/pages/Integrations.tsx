import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useIntegrations } from '@/hooks/useIntegrations';
import { useAddOns } from '@/hooks/useAddOns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Package2, FileSpreadsheet, CreditCard, Plus, Settings, Trash2, PlugZap, Lock, Activity } from 'lucide-react';
import { useForm } from 'react-hook-form';

const integrationTypes = [
  {
    type: 'shopify',
    name: 'Shopify',
    icon: ShoppingBag,
    addon_slug: 'shopify-integration',
    description: 'Sync orders, customers & stock',
    fields: ['shop_domain', 'access_token', 'webhook_secret', 'device_id', 'notify_phone'],
  },
  {
    type: 'woocommerce',
    name: 'WooCommerce',
    icon: Package2,
    addon_slug: 'woocommerce-integration',
    description: 'Connect your WooCommerce store',
    fields: ['store_url', 'consumer_key', 'consumer_secret', 'webhook_secret', 'device_id', 'notify_phone'],
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets',
    icon: FileSpreadsheet,
    addon_slug: 'google-sheets-sync',
    description: 'Import/export contacts automatically',
    fields: ['access_token', 'refresh_token'],
  },
  {
    type: 'payment_gateway',
    name: 'Payment Gateway',
    icon: CreditCard,
    addon_slug: 'payment-gateway-pack',
    description: 'Auto payment confirmation',
    fields: ['gateway', 'api_key', 'webhook_secret', 'device_id', 'notify_phone'],
  },
];

export default function Integrations() {
  const { integrations, logs, isLoading, createIntegration, updateIntegration, deleteIntegration } = useIntegrations();
  const { hasAddOn } = useAddOns();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = async (data: any) => {
    try {
      if (selectedType) {
        await createIntegration({
          integration_type: selectedType,
          config: data,
          is_active: true,
        });
        setIsDialogOpen(false);
        reset();
      }
    } catch (error) {
      console.error('Failed to create integration:', error);
    }
  };

  const getIntegrationIcon = (type: string) => {
    const integration = integrationTypes.find(i => i.type === type);
    return integration?.icon || PlugZap;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold mb-2">Integrations</h1>
          <p className="text-muted-foreground">
            Connect HalloWA dengan platform eksternal
          </p>
        </div>

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <PlugZap className="w-4 h-4" />
              Active Integrations
            </TabsTrigger>
            <TabsTrigger value="available" className="gap-2">
              <Plus className="w-4 h-4" />
              Available
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <Activity className="w-4 h-4" />
              Logs
            </TabsTrigger>
          </TabsList>

          {/* Active Integrations */}
          <TabsContent value="active" className="space-y-4">
            {integrations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <PlugZap className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Belum ada integrasi aktif</p>
                  <Button onClick={() => document.querySelector<HTMLElement>('[data-value="available"]')?.click()}>
                    Browse Integrations
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrations.map((integration) => {
                  const Icon = getIntegrationIcon(integration.integration_type);
                  const integrationInfo = integrationTypes.find(i => i.type === integration.integration_type);

                  return (
                    <Card key={integration.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10">
                              <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{integrationInfo?.name || integration.integration_type}</CardTitle>
                              <CardDescription className="text-sm">{integrationInfo?.description}</CardDescription>
                            </div>
                          </div>
                          <Badge variant={integration.is_active ? 'default' : 'secondary'}>
                            {integration.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Sync</span>
                          <span>{integration.last_sync_at ? new Date(integration.last_sync_at).toLocaleString() : 'Never'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline">{integration.sync_status}</Badge>
                        </div>
                        {integration.error_message && (
                          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                            {integration.error_message}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 gap-2">
                            <Settings className="w-4 h-4" />
                            Configure
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => deleteIntegration(integration.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Available Integrations */}
          <TabsContent value="available">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {integrationTypes.map((integration) => {
                const Icon = integration.icon;
                const hasRequiredAddon = hasAddOn(integration.addon_slug);
                const isAlreadyConnected = integrations.some(i => i.integration_type === integration.type);

                return (
                  <Card key={integration.type} className="relative">
                    <CardHeader>
                      <div className="flex items-start gap-3 mb-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <CardTitle className="text-lg">{integration.name}</CardTitle>
                          <CardDescription>{integration.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!hasRequiredAddon ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                            <Lock className="w-4 h-4" />
                            <span>Requires add-on purchase</span>
                          </div>
                          <Button variant="outline" className="w-full" asChild>
                            <a href="/addons">View Add-on</a>
                          </Button>
                        </div>
                      ) : isAlreadyConnected ? (
                        <Badge variant="secondary" className="w-full justify-center py-2">Connected</Badge>
                      ) : (
                        <Dialog open={isDialogOpen && selectedType === integration.type} onOpenChange={setIsDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full gap-2" onClick={() => setSelectedType(integration.type)}>
                              <Plus className="w-4 h-4" />
                              Connect
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Connect {integration.name}</DialogTitle>
                              <DialogDescription>Enter your {integration.name} credentials</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                              {integration.fields.map((field) => (
                                <div key={field} className="space-y-2">
                                  <Label htmlFor={field} className="capitalize">
                                    {field.replace(/_/g, ' ')}
                                  </Label>
                                  <Input
                                    id={field}
                                    {...register(field, { required: true })}
                                    placeholder={field.replace(/_/g, ' ')}
                                    type={field.includes('secret') || field.includes('token') || field.includes('key') ? 'password' : 'text'}
                                  />
                                </div>
                              ))}
                              <Button type="submit" className="w-full">Connect Integration</Button>
                            </form>
                          </DialogContent>
                        </Dialog>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Logs */}
          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Integration Activity Logs</CardTitle>
                <CardDescription>Recent sync activity and errors</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No activity logs yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                              {log.status}
                            </Badge>
                            <span className="text-sm font-medium">{log.sync_type}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Processed: {log.items_processed} | Failed: {log.items_failed}
                          </p>
                          {log.error_message && (
                            <p className="text-sm text-destructive mt-1">{log.error_message}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
