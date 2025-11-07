import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, Eye, Video, ExternalLink } from "lucide-react";
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
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export const AdminTutorials = () => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTutorials();

    // Realtime subscription
    const channel = supabase
      .channel('tutorials-admin-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tutorials'
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

  const fetchTutorials = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("tutorials")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTutorials(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat tutorials");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const extractYouTubeId = (url: string): string | null => {
    const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[7].length === 11) ? match[7] : null;
  };

  const generateThumbnail = (url: string): string => {
    const videoId = extractYouTubeId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const thumbnailUrl = generateThumbnail(videoUrl);

      const tutorialData = {
        title,
        description,
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl,
        category,
        duration,
        is_published: isPublished,
        created_by: user.id
      };

      if (editingTutorial) {
        // Update
        const { error } = await supabase
          .from("tutorials")
          .update(tutorialData)
          .eq("id", editingTutorial.id);

        if (error) throw error;
        toast.success("Tutorial berhasil diupdate");
      } else {
        // Create
        const { error } = await supabase
          .from("tutorials")
          .insert(tutorialData);

        if (error) throw error;
        toast.success("Tutorial berhasil ditambahkan");
      }

      resetForm();
      setDialogOpen(false);
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tutorial: Tutorial) => {
    setEditingTutorial(tutorial);
    setTitle(tutorial.title);
    setDescription(tutorial.description || "");
    setVideoUrl(tutorial.video_url);
    setCategory(tutorial.category || "");
    setDuration(tutorial.duration || "");
    setIsPublished(tutorial.is_published);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus tutorial ini?")) return;

    try {
      const { error } = await supabase
        .from("tutorials")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Tutorial berhasil dihapus");
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const togglePublish = async (tutorial: Tutorial) => {
    try {
      const { error } = await supabase
        .from("tutorials")
        .update({ is_published: !tutorial.is_published })
        .eq("id", tutorial.id);

      if (error) throw error;
      toast.success(tutorial.is_published ? "Tutorial diprivate" : "Tutorial dipublish");
      fetchTutorials();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const resetForm = () => {
    setEditingTutorial(null);
    setTitle("");
    setDescription("");
    setVideoUrl("");
    setCategory("");
    setDuration("");
    setIsPublished(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Kelola Tutorial</h1>
            <p className="text-muted-foreground mt-1">
              Manage tutorial videos untuk customer
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary">
                <Plus className="w-4 h-4 mr-2" />
                Tambah Tutorial
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTutorial ? "Edit Tutorial" : "Tambah Tutorial Baru"}
                </DialogTitle>
                <DialogDescription>
                  Isi informasi tutorial dengan link YouTube video
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Judul Tutorial *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Cara Mengirim Broadcast"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="videoUrl">URL Video YouTube *</Label>
                  <Input
                    id="videoUrl"
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=xxxxx"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste link YouTube video (support: youtube.com/watch, youtu.be)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan apa yang akan dipelajari dalam tutorial ini..."
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategori</Label>
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="Contoh: Broadcast, Device, API"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="duration">Durasi</Label>
                    <Input
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="Contoh: 5:30"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label htmlFor="published">Publish Tutorial</Label>
                    <p className="text-sm text-muted-foreground">
                      Tutorial akan langsung terlihat di halaman customer
                    </p>
                  </div>
                  <Switch
                    id="published"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? "Menyimpan..." : editingTutorial ? "Update" : "Tambah Tutorial"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="w-12 h-12 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-muted-foreground">Loading tutorials...</p>
            </CardContent>
          </Card>
        ) : tutorials.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-xl font-semibold mb-2">Belum ada tutorial</h3>
              <p className="text-muted-foreground mb-4">
                Mulai dengan menambahkan tutorial pertama
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Tutorial
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
                      <TableHead className="font-semibold">Preview</TableHead>
                      <TableHead className="font-semibold">Judul & Kategori</TableHead>
                      <TableHead className="font-semibold">Durasi</TableHead>
                      <TableHead className="font-semibold">Views</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tutorials.map((tutorial) => (
                      <TableRow key={tutorial.id} className="hover:bg-muted/30">
                        <TableCell>
                          <div className="w-32 h-20 rounded overflow-hidden bg-muted">
                            {tutorial.thumbnail_url ? (
                              <img
                                src={tutorial.thumbnail_url}
                                alt={tutorial.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/320x180?text=Video";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tutorial.title}</p>
                            {tutorial.category && (
                              <Badge variant="outline" className="mt-1">
                                {tutorial.category}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {tutorial.duration || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm">{tutorial.view_count}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={tutorial.is_published ? "bg-green-500" : "bg-gray-500"}>
                            {tutorial.is_published ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(tutorial.video_url, '_blank')}
                              title="Lihat Video"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => togglePublish(tutorial)}
                              title={tutorial.is_published ? "Unpublish" : "Publish"}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(tutorial)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(tutorial.id)}
                            >
                              <Trash2 className="w-4 h-4" />
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
      </div>
    </AdminLayout>
  );
};

export default AdminTutorials;
