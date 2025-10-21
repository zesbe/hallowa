import { Plus, Send, MessageSquare, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const FloatingActionButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const actions = [
    {
      label: "Broadcast Baru",
      icon: Send,
      onClick: () => navigate("/broadcast"),
      show: location.pathname !== "/broadcast",
    },
    {
      label: "Template Baru",
      icon: FileText,
      onClick: () => navigate("/templates"),
      show: location.pathname !== "/templates",
    },
    {
      label: "Pesan Cepat",
      icon: MessageSquare,
      onClick: () => navigate("/chatbot"),
      show: location.pathname !== "/chatbot",
    },
  ].filter((action) => action.show);

  if (actions.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-primary to-secondary hover:shadow-xl transition-all"
          >
            <Plus className="w-6 h-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.label}
              onClick={action.onClick}
              className="cursor-pointer"
            >
              <action.icon className="w-4 h-4 mr-2" />
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
