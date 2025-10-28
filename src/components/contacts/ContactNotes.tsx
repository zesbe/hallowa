import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ContactNotesProps {
  contactId: string;
  notes: string | null;
  contactName: string;
  onNotesUpdate: () => void;
}

export function ContactNotes({ contactId, notes, contactName, onNotesUpdate }: ContactNotesProps) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState(notes || "");

  const saveNotes = async () => {
    try {
      const { error } = await supabase
        .from("contacts")
        .update({ notes: noteText.trim() || null })
        .eq("id", contactId);

      if (error) throw error;

      toast.success("Catatan disimpan");
      setOpen(false);
      onNotesUpdate();
    } catch (error: any) {
      toast.error("Gagal menyimpan catatan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2">
          <FileText className={`w-3 h-3 mr-1 ${notes ? "text-primary" : ""}`} />
          {notes ? "Lihat" : "Catatan"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catatan - {contactName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="Tulis catatan tentang kontak ini..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={6}
          />
          <Button onClick={saveNotes} className="w-full">
            Simpan Catatan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
