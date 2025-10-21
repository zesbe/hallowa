import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, User, Grid } from "lucide-react";

interface ContactFilterProps {
  activeFilter: "all" | "groups" | "individuals";
  onFilterChange: (filter: "all" | "groups" | "individuals") => void;
  counts: {
    all: number;
    groups: number;
    individuals: number;
  };
}

export function ContactFilter({ activeFilter, onFilterChange, counts }: ContactFilterProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant={activeFilter === "all" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("all")}
        className="flex-1 min-w-[100px]"
      >
        <Grid className="w-4 h-4 mr-2" />
        Semua
        <Badge 
          variant="secondary" 
          className="ml-2"
        >
          {counts.all}
        </Badge>
      </Button>
      <Button
        variant={activeFilter === "groups" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("groups")}
        className="flex-1 min-w-[100px]"
      >
        <Users className="w-4 h-4 mr-2" />
        Grup
        <Badge 
          variant="secondary" 
          className="ml-2"
        >
          {counts.groups}
        </Badge>
      </Button>
      <Button
        variant={activeFilter === "individuals" ? "default" : "outline"}
        size="sm"
        onClick={() => onFilterChange("individuals")}
        className="flex-1 min-w-[100px]"
      >
        <User className="w-4 h-4 mr-2" />
        Individual
        <Badge 
          variant="secondary" 
          className="ml-2"
        >
          {counts.individuals}
        </Badge>
      </Button>
    </div>
  );
}
