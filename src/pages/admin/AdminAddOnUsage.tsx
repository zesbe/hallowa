import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Users, Package, TrendingUp, DollarSign } from 'lucide-react';

export default function AdminAddOnUsage() {
  // Fetch add-ons with usage stats
  const { data: addOnsData, isLoading } = useQuery({
    queryKey: ['admin-addon-usage'],
    queryFn: async () => {
      // Get all add-ons
      const { data: addOns, error: addOnsError } = await supabase
        .from('add_ons')
        .select('*')
        .order('name');

      if (addOnsError) throw addOnsError;

      // Get user add-ons without profile (will fetch separately)
      const { data: userAddOns, error: userAddOnsError } = await supabase
        .from('user_add_ons')
        .select(`
          *,
          add_on:add_ons(*)
        `)
        .eq('is_active', true);

      if (userAddOnsError) throw userAddOnsError;

      // Fetch user profiles for each user_id
      const userIds = [...new Set(userAddOns.map(ua => ua.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      // Map profiles to userAddOns
      const userAddOnsWithProfiles = userAddOns.map(ua => ({
        ...ua,
        profile: profiles?.find(p => p.id === ua.user_id)
      }));

      // Calculate stats for each add-on
      const stats = addOns.map(addon => {
        const purchases = userAddOnsWithProfiles.filter(ua => ua.add_on_id === addon.id);
        const activePurchases = purchases.filter(ua => ua.is_active);
        
        return {
          ...addon,
          totalPurchases: purchases.length,
          activePurchases: activePurchases.length,
          revenue: purchases.length * parseInt(addon.price.toString()),
          users: purchases
        };
      });

      return {
        addOns: stats,
        userAddOns: userAddOnsWithProfiles,
        totalRevenue: stats.reduce((sum, addon) => sum + addon.revenue, 0),
        totalActivePurchases: stats.reduce((sum, addon) => sum + addon.activePurchases, 0)
      };
    },
  });

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const { addOns, totalRevenue, totalActivePurchases, userAddOns } = addOnsData || {};

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Add-on Usage & Analytics</h1>
          <p className="text-muted-foreground">
            Monitor add-on sales, active users, and revenue statistics
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Add-ons</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{addOns?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                {addOns?.filter(a => a.is_active).length || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Purchases</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActivePurchases || 0}</div>
              <p className="text-xs text-muted-foreground">
                across all add-ons
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                Rp {(totalRevenue || 0).toLocaleString('id-ID')}
              </div>
              <p className="text-xs text-muted-foreground">
                from add-on sales
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. per Add-on</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {addOns && addOns.length > 0
                  ? Math.round((totalActivePurchases || 0) / addOns.length)
                  : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                purchases per add-on
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add-ons Table */}
        <Card>
          <CardHeader>
            <CardTitle>Add-ons Performance</CardTitle>
            <CardDescription>Sales and usage statistics for each add-on</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Add-on Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead className="text-center">Total Purchases</TableHead>
                  <TableHead className="text-center">Active Users</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addOns?.map((addon) => (
                  <TableRow key={addon.id}>
                    <TableCell className="font-medium">{addon.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{addon.category}</Badge>
                    </TableCell>
                    <TableCell>
                      Rp {parseInt(addon.price.toString()).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-center">{addon.totalPurchases}</TableCell>
                    <TableCell className="text-center">{addon.activePurchases}</TableCell>
                    <TableCell className="text-right font-semibold">
                      Rp {addon.revenue.toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={addon.is_active ? 'default' : 'secondary'}>
                        {addon.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Purchases</CardTitle>
            <CardDescription>Latest add-on purchases by users</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Add-on</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userAddOns
                  ?.sort((a, b) => new Date(b.purchased_at || b.payment_completed_at || '').getTime() - new Date(a.purchased_at || a.payment_completed_at || '').getTime())
                  .slice(0, 10)
                  .map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell>
                        {purchase.profile?.full_name || purchase.profile?.email || 'Unknown'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {purchase.add_on?.name || 'Unknown Add-on'}
                      </TableCell>
                      <TableCell>
                        {purchase.purchased_at || purchase.payment_completed_at
                          ? new Date(purchase.purchased_at || purchase.payment_completed_at!).toLocaleDateString('id-ID')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          purchase.payment_status === 'completed' ? 'default' :
                          purchase.payment_status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {purchase.payment_status || 'unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={purchase.is_active ? 'default' : 'secondary'}>
                          {purchase.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
