import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  User, 
  Phone, 
  Hash, 
  Shuffle, 
  Clock, 
  Calendar, 
  CalendarDays,
  Info,
  Copy,
  CheckCircle2,
  Database,
  Sparkles,
  Timer
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Variable {
  code: string;
  label: string;
  description: string;
  example: string;
  icon: React.ElementType;
  color: string;
  category: string;
}

interface MessageVariablesEnhancedProps {
  onInsert: (variable: string) => void;
  className?: string;
}

export const MessageVariablesEnhanced = ({ onInsert, className }: MessageVariablesEnhancedProps) => {
  const [copiedVar, setCopiedVar] = useState<string | null>(null);

  const variables: Variable[] = [
    // Data Kontak
    {
      code: "[[NAME]]",
      label: "Nama WhatsApp",
      description: "Nama WhatsApp penerima",
      example: "Halo [[NAME]]!",
      icon: User,
      color: "from-blue-500 to-indigo-600",
      category: "contact"
    },
    {
      code: "{nama}",
      label: "Nama Kontak",
      description: "Nama kontak dari database",
      example: "Terima kasih {nama}",
      icon: Database,
      color: "from-green-500 to-emerald-600",
      category: "contact"
    },
    {
      code: "{nomor}",
      label: "Nomor Telepon",
      description: "Nomor telepon penerima",
      example: "Nomor Anda: {nomor}",
      icon: Phone,
      color: "from-purple-500 to-pink-600",
      category: "contact"
    },
    // Variabel Custom
    {
      code: "{var1}",
      label: "Custom Variable 1",
      description: "Variabel custom 1 dari database",
      example: "Kode promo: {var1}",
      icon: Hash,
      color: "from-orange-500 to-red-600",
      category: "custom"
    },
    {
      code: "{var2}",
      label: "Custom Variable 2",
      description: "Variabel custom 2 dari database",
      example: "Produk: {var2}",
      icon: Hash,
      color: "from-cyan-500 to-blue-600",
      category: "custom"
    },
    {
      code: "{var3}",
      label: "Custom Variable 3",
      description: "Variabel custom 3 dari database",
      example: "Tanggal: {var3}",
      icon: Hash,
      color: "from-pink-500 to-rose-600",
      category: "custom"
    },
    // Text Dinamis
    {
      code: "(option1|option2|option3)",
      label: "Random Text",
      description: "Random dari pilihan (pisah dengan |)",
      example: "(Halo|Hai|Hi) selamat (pagi|siang|malam)!",
      icon: Shuffle,
      color: "from-teal-500 to-green-600",
      category: "dynamic"
    },
    // Waktu & Tanggal
    {
      code: "{{waktu}}",
      label: "Waktu Sekarang",
      description: "Waktu saat ini (HH:mm)",
      example: "Pesan dikirim pada {{waktu}}",
      icon: Clock,
      color: "from-indigo-500 to-purple-600",
      category: "time"
    },
    {
      code: "{{tanggal}}",
      label: "Tanggal Hari Ini",
      description: "Tanggal hari ini (DD/MM/YYYY)",
      example: "Tanggal: {{tanggal}}",
      icon: Calendar,
      color: "from-yellow-500 to-orange-600",
      category: "time"
    },
    {
      code: "{{hari}}",
      label: "Nama Hari",
      description: "Nama hari ini",
      example: "Selamat hari {{hari}}!",
      icon: CalendarDays,
      color: "from-red-500 to-pink-600",
      category: "time"
    }
  ];

  const handleInsert = (variable: string) => {
    onInsert(variable);
    toast.success(`Variable ${variable} inserted!`, {
      description: "Variable telah ditambahkan ke pesan",
      duration: 2000
    });
  };

  const handleCopy = (variable: string) => {
    navigator.clipboard.writeText(variable);
    setCopiedVar(variable);
    toast.success("Variable copied!", {
      description: `${variable} telah disalin ke clipboard`,
      duration: 2000
    });
    setTimeout(() => setCopiedVar(null), 2000);
  };

  const VariableCard = ({ variable }: { variable: Variable }) => {
    const Icon = variable.icon;
    const isCopied = copiedVar === variable.code;
    
    return (
      <Card className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/50 overflow-hidden card-enterprise">
        <div className="absolute inset-0 opacity-5">
          <div className={cn("h-full bg-gradient-to-br", variable.color)} />
        </div>
        <CardContent className="p-4 relative">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2.5 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform",
                variable.color
              )}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">{variable.label}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {variable.description}
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="bg-muted/50 dark:bg-muted/20 rounded-lg p-2.5 font-mono text-sm">
              <code className="text-primary font-semibold">{variable.code}</code>
            </div>
            
            <div className="bg-accent/50 rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground mb-1">Contoh:</p>
              <p className="text-xs font-medium italic">{variable.example}</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleInsert(variable.code)}
                className="flex-1 h-8 text-xs btn-enterprise gradient-enterprise-green text-white"
              >
                <Sparkles className="w-3 h-3 mr-1.5" />
                Insert
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(variable.code)}
                className="h-8 px-3"
              >
                {isCopied ? (
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const categories = [
    { id: "all", label: "Semua", icon: Sparkles },
    { id: "contact", label: "Data Kontak", icon: User },
    { id: "custom", label: "Custom", icon: Hash },
    { id: "dynamic", label: "Text Dinamis", icon: Shuffle },
    { id: "time", label: "Waktu", icon: Clock }
  ];

  return (
    <Card className={cn("border-0 shadow-xl", className)}>
      <CardHeader className="bg-gradient-to-r from-primary/10 via-secondary/5 to-primary/10">
        <CardTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          Variable Pesan Dinamis
        </CardTitle>
        <CardDescription>
          Personalisasi pesan Anda dengan variable otomatis
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full justify-start mb-6 h-auto flex-wrap gap-2 bg-transparent p-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-4 py-2 rounded-lg transition-all"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {categories.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-0">
              <ScrollArea className="h-[500px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {variables
                    .filter(v => cat.id === "all" || v.category === cat.id)
                    .map((variable, index) => (
                      <div
                        key={variable.code}
                        className="animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <VariableCard variable={variable} />
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
        
        {/* Tips Section */}
        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                Tips Penggunaan:
              </h4>
              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Klik tombol "Insert" untuk menambahkan variable ke pesan</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Gunakan (opsi1|opsi2|opsi3) untuk text random</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Variable akan diganti otomatis saat broadcast</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>{`{nama}, {var1}, {var2}, {var3} diambil dari tabel contacts`}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
                  <span>Kombinasikan multiple variable untuk personalisasi maksimal</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MessageVariablesEnhanced;