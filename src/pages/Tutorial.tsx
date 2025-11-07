import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Video, Play, Search, Eye, Clock, Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  category: string | null;
  duration: string | null;
  view_count: number;
  created_at: string;
}

export const Tutorial = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [filteredTutorials, setFilteredTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Tutorial | null>(null);

  useEffect(() => {
    fetchTutorials();

    // Realtime subscription for live updates
    const channel = supabase
      .channel('tutorials-public-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tutorials',
          filter: 'is_published=eq.true'
        },
        (payload) => {
          console.log('Tutorial update:', payload);
          fetchTutorials();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterTutorials();
  }, [searchQuery, selectedCategory, tutorials]);

  const fetchTutorials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutorials")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTutorials(data || []);
      setFilteredTutorials(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat tutorials");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filterTutorials = () => {
    let filtered = [...tutorials];

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    setFilteredTutorials(filtered);
  };

  const getUniqueCategories = (): string[] => {
    const categories = tutorials
      .map(t => t.category)
      .filter((c): c is string => c !== null);
    return Array.from(new Set(categories));
  };

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const getEmbedUrl = (url: string): string => {
    const videoId = extractYouTubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  };

  const incrementViewCount = async (tutorialId: string) => {
    try {
      const tutorial = tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return;

      await supabase
        .from("tutorials")
        .update({ view_count: tutorial.view_count + 1 })
        .eq("id", tutorialId);
    } catch (error) {
      console.error("Failed to increment view count:", error);
    }
  };

  const handleWatchVideo = (tutorial: Tutorial) => {
    setSelectedVideo(tutorial);
    incrementViewCount(tutorial.id);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            📚 Tutorial & Panduan
          </h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Pelajari cara menggunakan platform dengan video tutorial lengkap
          </p>
        </div>

        {/* Search & Filter */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari tutorial..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedCategory && (
                  <Badge
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(null)}
                  >
                    {selectedCategory}
                    <X className="w-3 h-3 ml-1" />
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const categories = getUniqueCategories();
                    const nextIndex = selectedCategory
                      ? (categories.indexOf(selectedCategory) + 1) % categories.length
                      : 0;
                    setSelectedCategory(categories[nextIndex] || null);
                  }}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Kategori
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Player Modal */}
        {selectedVideo && (
          <Card className="border-2 border-primary">
            <CardContent className="p-4 md:p-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-bold mb-2">
                      {selectedVideo.title}
                    </h2>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {selectedVideo.category && (
                        <Badge variant="secondary">
                          {selectedVideo.category}
                        </Badge>
                      )}
                      {selectedVideo.duration && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {selectedVideo.duration}
                        </Badge>
                      )}
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {selectedVideo.view_count} views
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedVideo(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                  <iframe
                    width="100%"
                    height="100%"
                    src={getEmbedUrl(selectedVideo.video_url)}
                    title={selectedVideo.title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {selectedVideo.description && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">Deskripsi</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedVideo.description}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tutorials Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-0">
                  <div className="aspect-video bg-muted animate-pulse" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-muted animate-pulse rounded" />
                    <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredTutorials.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Tidak ada tutorial</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedCategory
                  ? "Coba ubah filter pencarian"
                  : "Tutorial belum tersedia"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTutorials.map((tutorial) => (
              <Card
                key={tutorial.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={() => handleWatchVideo(tutorial)}
              >
                <CardContent className="p-0">
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {tutorial.thumbnail_url ? (
                      <img
                        src={tutorial.thumbnail_url}
                        alt={tutorial.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/640x360?text=Video";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    {/* Play Overlay */}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
                      </div>
                    </div>
                    {/* Duration Badge */}
                    {tutorial.duration && (
                      <Badge className="absolute bottom-2 right-2 bg-black/80 text-white">
                        {tutorial.duration}
                      </Badge>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                      {tutorial.title}
                    </h3>
                    {tutorial.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {tutorial.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {tutorial.view_count}
                        </span>
                        {tutorial.category && (
                          <Badge variant="outline" className="text-xs">
                            {tutorial.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tutorial;
