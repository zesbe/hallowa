import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Check } from "lucide-react";

interface WhatsAppPreviewProps {
  message: string;
  hasMedia?: boolean;
  mediaUrl?: string | null;
}

export function WhatsAppPreview({ message, hasMedia, mediaUrl }: WhatsAppPreviewProps) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <Card className="bg-[#e5ddd5] border-none shadow-xl">
        <CardContent className="p-4">
          {/* WhatsApp Header */}
          <div className="bg-[#075e54] text-white p-3 -m-4 mb-4 rounded-t-lg flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-lg font-semibold">
              BC
            </div>
            <div>
              <p className="font-semibold">Broadcast Preview</p>
              <p className="text-xs opacity-80">Preview pesan Anda</p>
            </div>
          </div>

          {/* Message Bubble */}
          <div className="space-y-2">
            <div className="flex justify-end">
              <div className="bg-[#dcf8c6] rounded-lg p-3 max-w-[85%] shadow-sm">
                {hasMedia && mediaUrl && (
                  <div className="mb-2 rounded-md overflow-hidden">
                    <img 
                      src={mediaUrl} 
                      alt="Media preview" 
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                {hasMedia && !mediaUrl && (
                  <div className="mb-2 bg-muted/50 rounded-md p-4 flex items-center justify-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Media terlampir</span>
                  </div>
                )}
                <p className="text-sm whitespace-pre-wrap break-words">
                  {message || "Tulis pesan Anda di sini..."}
                </p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-gray-600">
                    {new Date().toLocaleTimeString('id-ID', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                  <Check className="w-3 h-3 text-blue-500" />
                  <Check className="w-3 h-3 text-blue-500 -ml-2" />
                </div>
              </div>
            </div>
          </div>

          {/* Info Badge */}
          <div className="mt-3 flex justify-center">
            <Badge variant="secondary" className="text-xs">
              ✨ Begini tampilan pesanmu
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
