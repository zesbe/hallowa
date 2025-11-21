import { useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { useAdminAddOns } from '@/hooks/useAddOns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Package, Plus, Edit, Trash2, Sparkles, Zap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function AdminAddons() {
  const { addOns, isLoading, createAddOn, updateAddOn, deleteAddOn } = useAdminAddOns();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any>(null);
  const { register, handleSubmit, reset, setValue, watch } = useForm();

  // Fetch user add-ons for analytics
  const { data: userAddons } = useQuery({
    queryKey: ['admin-user-addons'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_add_ons')
        .select('add_on_id, add_on:add_ons(name)');
      return data || [];
    },
  });

  const onSubmit = async (data: any) => {
    try {
      const features = data.features?.split('\n').filter((f: string) => f.trim()) || [];
      const payload = {
        ...data,
        features,
        price: parseFloat(data.price),
        metadata: {},
      };

      if (editingAddon) {
        await updateAddOn({ id: editingAddon.id, ...payload });
      } else {
        await createAddOn(payload);
      }
      setIsDialogOpen(false);
      setEditingAddon(null);
      reset();
    } catch (error) {
      console.error('Failed to save add-on:', error);
    }
  };

  const handleEdit = (addon: any) => {
    setEditingAddon(addon);
    setValue('name', addon.name);
    setValue('slug', addon.slug);
    setValue('description', addon.description);
    setValue('category', addon.category);
    setValue('price', addon.price);
    setValue('is_active', addon.is_active);
    setValue('features', Array.isArray(addon.features) ? addon.features.join('\n') : '');
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus add-on ini? Data pembelian user akan tetap ada.')) {
      await deleteAddOn(id);
    }
  };

  const getPurchaseCount = (addonId: string) => {
    if (!userAddons) return 0;
    return userAddons.filter((ua: any) => ua.add_on_id === addonId).length;
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage Add-ons</h1>
            <p className="text-muted-foreground">
              Create and manage add-ons for marketplace
            </p>
          </div>
          <Sheet open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <SheetTrigger asChild>
              <Button onClick={() => { setEditingAddon(null); reset(); }} className="gap-2">
                <Plus className="w-4 h-4" />
                New Add-on
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{editingAddon ? 'Edit' : 'Create'} Add-on</SheetTitle>
                <SheetDescription>Manage add-on details and pricing</SheetDescription>
              </SheetHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" {...register('name', { required: true })} placeholder="AI Chatbot Pro" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input id="slug" {...register('slug', { required: true })} placeholder="ai-chatbot-pro" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" {...register('description')} rows={3} placeholder="Advanced AI chatbot with unlimited conversations..." />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select {...register('category', { required: true })} onValueChange={(val) => setValue('category', val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chatbot">Chatbot</SelectItem>
                        <SelectItem value="integration">Integration</SelectItem>
                        <SelectItem value="automation">Automation</SelectItem>
                        <SelectItem value="template">Template</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Price (IDR) *</Label>
                    <Input id="price" type="number" {...register('price', { required: true })} placeholder="150000" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="features">Features (one per line)</Label>
                  <Textarea
                    id="features"
                    {...register('features')}
                    rows={5}
                    placeholder="Natural language understanding&#10;Auto-reply cerdas&#10;100 conversations/month"
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <Label htmlFor="is_active" className="text-base">Active</Label>
                    <p className="text-sm text-muted-foreground">Show in marketplace</p>
                  </div>
                  <Switch id="is_active" {...register('is_active')} defaultChecked onCheckedChange={(val) => setValue('is_active', val)} />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingAddon(null); reset(); }} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1">
                    {editingAddon ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </SheetContent>
          </Sheet>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Add-ons</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{addOns.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {addOns.filter(a => a.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{userAddons?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Est)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                Rp {((userAddons?.length || 0) * 150000).toLocaleString('id-ID')}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add-ons List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {addOns.map((addon) => {
            const Icon = addon.category === 'chatbot' ? Sparkles : addon.category === 'integration' ? Zap : Package;
            const purchaseCount = getPurchaseCount(addon.id);

            return (
              <Card key={addon.id} className={addon.is_active ? '' : 'opacity-60'}>
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant={addon.is_active ? 'default' : 'secondary'}>
                      {addon.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{addon.name}</CardTitle>
                  <CardDescription className="line-clamp-2">{addon.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Category</span>
                    <Badge variant="outline">{addon.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Price</span>
                    <span className="font-bold">Rp {parseInt(addon.price.toString()).toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Purchases</span>
                    <Badge>{purchaseCount}</Badge>
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(addon)} className="flex-1 gap-2">
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDelete(addon.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
