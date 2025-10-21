import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CSVImportProps {
  onImport: (numbers: string[]) => void;
}

export function CSVImport({ onImport }: CSVImportProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      toast.error("File harus berformat CSV atau TXT");
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
      
      // Extract phone numbers (support various formats)
      const phoneNumbers: string[] = [];
      lines.forEach(line => {
        // Split by comma, semicolon, or tab
        const parts = line.split(/[,;\t]/).map(p => p.trim());
        parts.forEach(part => {
          // Remove non-digit characters except plus at start
          const cleaned = part.replace(/[^\d+]/g, '');
          // Validate it looks like a phone number (starts with + or digit, at least 10 digits)
          if (cleaned.length >= 10 && /^[\d+]/.test(cleaned)) {
            phoneNumbers.push(cleaned);
          }
        });
      });

      if (phoneNumbers.length === 0) {
        toast.error("Tidak ada nomor valid ditemukan di file");
        return;
      }

      // Remove duplicates
      const uniqueNumbers = Array.from(new Set(phoneNumbers));
      
      onImport(uniqueNumbers);
      toast.success(`${uniqueNumbers.length} nomor berhasil diimport`);
      setOpen(false);
    } catch (error: any) {
      toast.error("Gagal membaca file: " + error.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileSpreadsheet className="w-4 h-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Nomor dari CSV</DialogTitle>
          <DialogDescription>
            Upload file CSV atau TXT berisi nomor telepon
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>Format yang didukung:</strong>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>Satu nomor per baris</li>
                <li>Pisahkan dengan koma (,) atau titik koma (;)</li>
                <li>Format: 628123456789 atau +628123456789</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              disabled={importing}
              className="hidden"
              id="csv-upload"
            />
            <label 
              htmlFor="csv-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {importing ? "Mengimport..." : "Klik untuk upload file"}
              </p>
              <p className="text-xs text-muted-foreground">
                CSV atau TXT, maksimal 5MB
              </p>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
