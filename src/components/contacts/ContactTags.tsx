import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Plus, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactTagsProps {
  contactId: string;
  tags: string[];
  onTagsUpdate: () => void;
}

export function ContactTags({ contactId, tags, onTagsUpdate }: ContactTagsProps) {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");

  const addTag = async () => {
    if (!newTag.trim()) return;

    const normalizedTag = newTag.trim().toLowerCase();
    if (tags.includes(normalizedTag)) {
      toast.error("Tag sudah ada");
      return;
    }

    try {
      const { error } = await supabase
        .from("contacts")
        .update({ tags: [...tags, normalizedTag] })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Tag ditambahkan");
      setNewTag("");
      onTagsUpdate();
    } catch (error: any) {
      toast.error("Gagal menambahkan tag");
    }
  };

  const removeTag = async (tagToRemove: string) => {
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ tags: tags.filter((t) => t !== tagToRemove) })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Tag dihapus");
      onTagsUpdate();
    } catch (error: any) {
      toast.error("Gagal menghapus tag");
    }
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {tags.map((tag) => (
        <Badge key={tag} variant="outline" className="text-xs gap-1">
          {tag}
          <X
            className="w-3 h-3 cursor-pointer hover:text-destructive"
            onClick={() => removeTag(tag)}
          />
        </Badge>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2">
            <Plus className="w-3 h-3 mr-1" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <h4 className="font-medium text-sm">Tambah Tag</h4>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nama tag..."
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addTag();
                  }
                }}
              />
              <Button size="sm" onClick={addTag}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
