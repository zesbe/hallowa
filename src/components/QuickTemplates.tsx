import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  content: string;
}

interface QuickTemplatesProps {
  onSelectTemplate: (content: string) => void;
}

export function QuickTemplates({ onSelectTemplate }: QuickTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("message_templates")
        .select("id, name, content")
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || templates.length === 0) return null;

  return (
    <Card className="border-dashed border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Template Cepat</h4>
          <Badge variant="secondary" className="text-xs">Quick</Badge>
        </div>
        <div className="space-y-2">
          {templates.map((template) => (
            <Button
              key={template.id}
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2"
              onClick={() => {
                onSelectTemplate(template.content);
                toast.success(`Template "${template.name}" digunakan`);
              }}
            >
              <FileText className="w-4 h-4 mr-2 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs truncate">{template.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {template.content.substring(0, 40)}...
                </p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
