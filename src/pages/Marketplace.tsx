import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  ShoppingCart,
  Download,
  Star,
  Tag,
  TrendingUp,
  MessageSquare,
  Bot,
  Radio,
  Zap,
  Sparkles,
  CheckCircle2,
  Crown
} from "lucide-react";

interface MarketplaceProduct {
  id: string;
  name: string;
  description: string | null;
  category: string;
  type: string;
  price: number;
  currency: string;
  thumbnail_url: string | null;
  preview_images: string[] | null;
  content: any;
  tags: string[] | null;
  downloads: number;
  rating: number;
  is_published: boolean;
  is_featured: boolean;
}

interface UserPurchase {
  product_id: string;
  purchase_date: string;
}

export default function Marketplace() {
  const { user } = useAuth();
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [purchases, setPurchases] = useState<UserPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popular");
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchPurchases();
      setupRealtimeSubscription();
    }
  }, [user]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("marketplace_products")
        .select("*")
        .eq("is_published", true);

      // Apply filters
      if (selectedCategory !== "all") {
        query = query.eq("category", selectedCategory);
      }
      if (selectedType !== "all") {
        query = query.eq("type", selectedType);
      }

      // Apply sorting
      switch (sortBy) {
        case "popular":
          query = query.order("downloads", { ascending: false });
          break;
        case "rating":
          query = query.order("rating", { ascending: false });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "price_low":
          query = query.order("price", { ascending: true });
          break;
        case "price_high":
          query = query.order("price", { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      toast.error("Gagal memuat produk");
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from("user_purchases")
        .select("product_id, purchase_date")
        .eq("user_id", user?.id);

      if (error) throw error;
      setPurchases(data || []);
    } catch (error: any) {
      console.error("Error fetching purchases:", error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel("marketplace-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "marketplace_products"
        },
        () => {
          fetchProducts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
    }
  }, [selectedCategory, selectedType, sortBy]);

  const filteredProducts = products.filter((product) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      product.name.toLowerCase().includes(search) ||
      product.description?.toLowerCase().includes(search) ||
      product.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  });

  const isPurchased = (productId: string) => {
    return purchases.some(p => p.product_id === productId);
  };

  const handleDownload = async (product: MarketplaceProduct) => {
    try {
      // Check if already purchased for premium items
      if (product.type === "premium" && !isPurchased(product.id)) {
        toast.error("Silakan beli produk terlebih dahulu");
        return;
      }

      // Increment download count
      await supabase.rpc("increment_product_downloads", { p_product_id: product.id });

      // Download content
      const contentStr = JSON.stringify(product.content, null, 2);
      const blob = new Blob([contentStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${product.name.replace(/\s+/g, "_")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Produk berhasil diunduh!");
      fetchProducts(); // Refresh to update download count
    } catch (error: any) {
      console.error("Error downloading:", error);
      toast.error("Gagal mengunduh produk");
    }
  };

  const handlePurchase = async (product: MarketplaceProduct) => {
    try {
      if (isPurchased(product.id)) {
        toast.info("Anda sudah membeli produk ini");
        return;
      }

      // In real app, integrate with payment gateway
      // For now, we'll simulate purchase
      const { error } = await supabase
        .from("user_purchases")
        .insert({
          user_id: user?.id,
          product_id: product.id,
          price_paid: product.price
        });

      if (error) throw error;

      toast.success("Pembelian berhasil! 🎉");
      fetchPurchases();
    } catch (error: any) {
      console.error("Error purchasing:", error);
      toast.error("Gagal membeli produk");
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "template":
        return <MessageSquare className="w-5 h-5" />;
      case "chatbot":
        return <Bot className="w-5 h-5" />;
      case "broadcast":
        return <Radio className="w-5 h-5" />;
      case "automation":
        return <Zap className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      template: "Template",
      chatbot: "Chatbot",
      broadcast: "Broadcast",
      automation: "Automation",
      integration: "Integration"
    };
    return labels[category] || category;
  };

  const formatPrice = (price: number, currency: string = "IDR") => {
    if (price === 0) return "Gratis";
    if (currency === "IDR") {
      return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR"
      }).format(price);
    }
    return `${currency} ${price.toFixed(2)}`;
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <ShoppingCart className="w-8 h-8 text-primary" />
          Marketplace
        </h1>
        <p className="text-muted-foreground">
          Temukan template, chatbot, dan fitur premium untuk WhatsApp Anda
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Cari template, chatbot, atau fitur..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                <SelectItem value="template">Template</SelectItem>
                <SelectItem value="chatbot">Chatbot</SelectItem>
                <SelectItem value="broadcast">Broadcast</SelectItem>
                <SelectItem value="automation">Automation</SelectItem>
                <SelectItem value="integration">Integration</SelectItem>
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger>
                <SelectValue placeholder="Tipe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="free">Gratis</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger>
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Terpopuler</SelectItem>
                <SelectItem value="rating">Rating Tertinggi</SelectItem>
                <SelectItem value="newest">Terbaru</SelectItem>
                <SelectItem value="price_low">Harga Terendah</SelectItem>
                <SelectItem value="price_high">Harga Tertinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredProducts.length}</p>
              <p className="text-sm text-muted-foreground">Produk Tersedia</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredProducts.filter(p => p.type === "free").length}</p>
              <p className="text-sm text-muted-foreground">Gratis</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{filteredProducts.filter(p => p.is_featured).length}</p>
              <p className="text-sm text-muted-foreground">Featured</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{purchases.length}</p>
              <p className="text-sm text-muted-foreground">Dibeli</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Grid */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-muted-foreground">Memuat produk...</p>
          </CardContent>
        </Card>
      ) : filteredProducts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow overflow-hidden group">
              {/* Thumbnail */}
              <div className="relative h-48 bg-gradient-to-br from-primary/20 to-secondary/20 overflow-hidden">
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {getCategoryIcon(product.category)}
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  {product.is_featured && (
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600">
                      <Crown className="w-3 h-3 mr-1" />
                      Featured
                    </Badge>
                  )}
                  {isPurchased(product.id) && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Owned
                    </Badge>
                  )}
                </div>

                <div className="absolute top-3 right-3">
                  <Badge
                    variant="secondary"
                    className={
                      product.type === "free"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    }
                  >
                    {product.type === "free" ? "Gratis" : "Premium"}
                  </Badge>
                </div>
              </div>

              {/* Content */}
              <CardHeader>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(product.category)}
                    <Badge variant="outline">{getCategoryLabel(product.category)}</Badge>
                  </div>
                </div>

                <CardTitle className="line-clamp-1">{product.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {product.description || "Tidak ada deskripsi"}
                </CardDescription>
              </CardHeader>

              <CardContent>
                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {product.downloads}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {product.rating.toFixed(1)}
                  </div>
                </div>

                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {product.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Price and Action */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xl font-bold text-primary">
                    {formatPrice(product.price, product.currency)}
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedProduct(product)}
                      >
                        Detail
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          {getCategoryIcon(product.category)}
                          {product.name}
                        </DialogTitle>
                        <DialogDescription>
                          {getCategoryLabel(product.category)} • {product.type === "free" ? "Gratis" : "Premium"}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        {/* Image Gallery */}
                        {product.preview_images && product.preview_images.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {product.preview_images.map((img, idx) => (
                              <img
                                key={idx}
                                src={img}
                                alt={`Preview ${idx + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                            ))}
                          </div>
                        )}

                        {/* Description */}
                        <div>
                          <h4 className="font-semibold mb-2">Deskripsi</h4>
                          <p className="text-sm text-muted-foreground">
                            {product.description || "Tidak ada deskripsi"}
                          </p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <Download className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                            <p className="text-sm font-semibold">{product.downloads}</p>
                            <p className="text-xs text-muted-foreground">Downloads</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <Star className="w-5 h-5 mx-auto mb-1 text-yellow-400 fill-yellow-400" />
                            <p className="text-sm font-semibold">{product.rating.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Rating</p>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-primary" />
                            <p className="text-sm font-semibold">{formatPrice(product.price, product.currency)}</p>
                            <p className="text-xs text-muted-foreground">Harga</p>
                          </div>
                        </div>

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                          <div>
                            <h4 className="font-semibold mb-2">Tags</h4>
                            <div className="flex flex-wrap gap-2">
                              {product.tags.map((tag, idx) => (
                                <Badge key={idx} variant="secondary">
                                  <Tag className="w-3 h-3 mr-1" />
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                          {product.type === "free" || isPurchased(product.id) ? (
                            <Button
                              onClick={() => handleDownload(product)}
                              className="flex-1"
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => handlePurchase(product)}
                                disabled={isPurchased(product.id)}
                                className="flex-1"
                              >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Beli Sekarang
                              </Button>
                              {isPurchased(product.id) && (
                                <Button
                                  onClick={() => handleDownload(product)}
                                  variant="outline"
                                  className="flex-1"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Download
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
