import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { useAddOns } from '@/hooks/useAddOns';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, ShoppingCart, Sparkles, Package, Zap } from 'lucide-react';

export default function AddOnsMarketplace() {
  const { addOns, userAddOns, isLoading, purchaseAddOn, isPurchasing, hasAddOn } = useAddOns();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { value: 'all', label: 'All Add-ons', icon: Package },
    { value: 'chatbot', label: 'AI Chatbot', icon: Sparkles },
    { value: 'integration', label: 'Integrations', icon: Zap },
  ];

  const filteredAddOns = selectedCategory === 'all' 
    ? addOns 
    : addOns.filter(addon => addon.category === selectedCategory);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'chatbot': return Sparkles;
      case 'integration': return Zap;
      default: return Package;
    }
  };

  const handlePurchase = async (addOnId: string) => {
    try {
      await purchaseAddOn({ addOnId });
    } catch (error) {
      console.error('Purchase failed:', error);
    }
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
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 border">
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">Add-ons Marketplace</h1>
            <p className="text-muted-foreground text-lg">
              Tingkatkan kemampuan HalloWA dengan add-ons premium
            </p>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -z-0"></div>
        </div>

        {/* My Add-ons Summary */}
        {userAddOns.length > 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="w-5 h-5" />
                My Active Add-ons
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userAddOns.map((ua) => (
                  <Badge key={ua.id} variant="default" className="px-3 py-1">
                    {ua.add_on?.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Tabs */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full max-w-md grid-cols-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger key={cat.value} value={cat.value} className="gap-2">
                  <Icon className="w-4 h-4" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAddOns.map((addon) => {
                const Icon = getCategoryIcon(addon.category);
                const isPurchased = hasAddOn(addon.slug);

                return (
                  <div key={addon.id}>
                    <Card className="h-full flex flex-col hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="w-6 h-6 text-primary" />
                          </div>
                          <Badge variant="outline">{addon.category}</Badge>
                        </div>
                        <CardTitle className="text-xl">{addon.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {addon.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-grow">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Features:</p>
                          <ul className="space-y-1.5">
                            {Array.isArray(addon.features) && addon.features.slice(0, 4).map((feature: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm">
                                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>

                      <CardFooter className="flex items-center justify-between border-t pt-4">
                        <div>
                          <p className="text-2xl font-bold">
                            Rp {parseInt(addon.price.toString()).toLocaleString('id-ID')}
                          </p>
                          <p className="text-xs text-muted-foreground">one-time payment</p>
                        </div>
                        {isPurchased ? (
                          <Button variant="outline" disabled className="gap-2">
                            <Check className="w-4 h-4" />
                            Owned
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handlePurchase(addon.id)}
                            disabled={isPurchasing}
                            className="gap-2"
                          >
                            <ShoppingCart className="w-4 h-4" />
                            Buy Now
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  </div>
                );
              })}
            </div>

            {filteredAddOns.length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No add-ons found in this category</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
