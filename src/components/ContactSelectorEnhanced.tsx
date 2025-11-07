import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, User, Tag, CheckSquare, XSquare } from "lucide-react";
import { Card } from "@/components/ui/card";

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  is_group?: boolean;
  tags?: string[];
  group_members?: any;
}

interface ContactSelectorEnhancedProps {
  contacts: Contact[];
  selectedContacts: string[];
  onToggleContact: (phoneNumber: string) => void;
  onSelectByTag: (tag: string) => void;
  onSelectAll: (phoneNumbers: string[]) => void;
  onClearAll: () => void;
}

export const ContactSelectorEnhanced = ({
  contacts,
  selectedContacts,
  onToggleContact,
  onSelectByTag,
  onSelectAll,
  onClearAll,
}: ContactSelectorEnhancedProps) => {
  const [contactSearch, setContactSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"all" | "groups" | "individuals">("all");

  // Get all unique tags from contacts
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    contacts.forEach(contact => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [contacts]);

  // Get contact counts by tag
  const tagCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    contacts.forEach(contact => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    return counts;
  }, [contacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(contact => {
      // Search filter
      const matchesSearch = 
        contact.name?.toLowerCase().includes(contactSearch.toLowerCase()) ||
        contact.phone_number.includes(contactSearch);

      if (!matchesSearch) return false;

      // Type filter
      if (selectedFilter === "groups" && !contact.is_group) return false;
      if (selectedFilter === "individuals" && contact.is_group) return false;

      return true;
    });
  }, [contacts, contactSearch, selectedFilter]);

  // Group contacts by tags
  const contactsByTag = useMemo(() => {
    const grouped: { [key: string]: Contact[] } = {};
    allTags.forEach(tag => {
      grouped[tag] = contacts.filter(contact => 
        contact.tags?.includes(tag)
      );
    });
    return grouped;
  }, [contacts, allTags]);

  const handleSelectByTag = (tag: string) => {
    const contactsWithTag = contactsByTag[tag] || [];
    const phoneNumbers = contactsWithTag.map(c => c.phone_number);
    onSelectAll(phoneNumbers);
  };

  const handleSelectAllFiltered = () => {
    const phoneNumbers = filteredContacts.map(c => c.phone_number);
    onSelectAll(phoneNumbers);
  };

  const isTagFullySelected = (tag: string) => {
    const contactsWithTag = contactsByTag[tag] || [];
    return contactsWithTag.length > 0 && 
      contactsWithTag.every(c => selectedContacts.includes(c.phone_number));
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list" className="gap-2">
            <User className="w-4 h-4" />
            <span>Daftar Kontak</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-2">
            <Tag className="w-4 h-4" />
            <span>Pilih by Tag</span>
          </TabsTrigger>
        </TabsList>

        {/* List Tab - Original contact list with improvements */}
        <TabsContent value="list" className="space-y-3 mt-4">
          <div className="space-y-3">
            <Input
              placeholder="Cari kontak..."
              value={contactSearch}
              onChange={(e) => setContactSearch(e.target.value)}
              className="h-10"
            />

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectAllFiltered}
                className="gap-2 flex-1"
              >
                <CheckSquare className="w-4 h-4" />
                Pilih Semua ({filteredContacts.length})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClearAll}
                className="gap-2 flex-1"
              >
                <XSquare className="w-4 h-4" />
                Hapus Semua
              </Button>
            </div>

            <div className="flex gap-2">
              <Badge
                variant={selectedFilter === "all" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedFilter("all")}
              >
                Semua ({contacts.length})
              </Badge>
              <Badge
                variant={selectedFilter === "groups" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedFilter("groups")}
              >
                Grup ({contacts.filter(c => c.is_group).length})
              </Badge>
              <Badge
                variant={selectedFilter === "individuals" ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedFilter("individuals")}
              >
                Individu ({contacts.filter(c => !c.is_group).length})
              </Badge>
            </div>
          </div>

          <ScrollArea className="h-80 border rounded-lg p-2">
            <div className="space-y-1">
              {filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm">Tidak ada kontak ditemukan</p>
                </div>
              ) : (
                filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-start gap-3 p-3 hover:bg-accent rounded-lg cursor-pointer transition-colors"
                    onClick={() => onToggleContact(contact.phone_number)}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.phone_number)}
                      className="mt-0.5"
                    />
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {contact.is_group ? (
                        <Users className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      ) : (
                        <User className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.name || contact.phone_number}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.phone_number}
                        </p>
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {contact.tags.map(tag => (
                              <Badge 
                                key={tag} 
                                variant="secondary" 
                                className="text-xs px-1.5 py-0"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Tags Tab - Quick selection by tags */}
        <TabsContent value="tags" className="space-y-3 mt-4">
          {allTags.length === 0 ? (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                <Tag className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium mb-1">Belum ada tag</p>
                <p className="text-xs">
                  Tambahkan tag di halaman Kontak untuk memudahkan pengelompokan
                </p>
              </div>
            </Card>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Pilih kontak berdasarkan tag dengan satu klik
              </div>
              <ScrollArea className="h-80">
                <div className="space-y-2">
                  {allTags.map(tag => {
                    const count = tagCounts[tag] || 0;
                    const isSelected = isTagFullySelected(tag);
                    
                    return (
                      <Card
                        key={tag}
                        className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                          isSelected ? 'border-primary bg-primary/5' : ''
                        }`}
                        onClick={() => handleSelectByTag(tag)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                            }`}>
                              <Tag className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{tag}</p>
                              <p className="text-xs text-muted-foreground">
                                {count} kontak
                              </p>
                            </div>
                          </div>
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : (
                            <div className="w-5 h-5 border-2 rounded" />
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between bg-accent/50 rounded-lg p-3">
        <span className="text-sm text-muted-foreground">Total dipilih</span>
        <Badge variant="default" className="text-base font-semibold">
          {selectedContacts.length}
        </Badge>
      </div>
    </div>
  );
};
