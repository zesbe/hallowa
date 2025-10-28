import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Plus, Download, UserPlus, Filter } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ContactFilter } from "@/components/ContactFilter";
import { ContactImport } from "@/components/contacts/ContactImport";
import { GroupManagement } from "@/components/contacts/GroupManagement";
import { ContactCard } from "@/components/contacts/ContactCard";
import { useNavigate, useSearchParams } from "react-router-dom";

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  is_group: boolean;
  group_members: any;
  created_at: string;
  tags?: string[];
  notes?: string | null;
  last_contacted_at?: string | null;
  contact_count?: number;
}

export const Contacts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "groups" | "individuals">("all");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentContact, setCurrentContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone_number: "",
    is_group: false,
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  // Update filter when URL changes
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam === 'groups') {
      setActiveFilter('groups');
    } else if (filterParam === 'individuals') {
      setActiveFilter('individuals');
    } else {
      setActiveFilter('all');
    }
  }, [searchParams]);

  useEffect(() => {
    let filtered = contacts;

    // Apply type filter
    if (activeFilter === "groups") {
      filtered = filtered.filter((c) => c.is_group);
    } else if (activeFilter === "individuals") {
      filtered = filtered.filter((c) => !c.is_group);
    }

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter((contact) =>
        contact.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone_number.includes(searchQuery)
      );
    }

    setFilteredContacts(filtered);
  }, [searchQuery, contacts, activeFilter]);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
      setFilteredContacts(data || []);
    } catch (error: any) {
      toast.error("Gagal memuat kontak");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus kontak ini?")) return;

    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;

      toast.success("Kontak berhasil dihapus");
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) {
      toast.error("Pilih kontak terlebih dahulu");
      return;
    }
    if (!confirm(`Yakin ingin menghapus ${selectedContacts.length} kontak?`)) return;

    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .in("id", selectedContacts);
      if (error) throw error;

      toast.success(`${selectedContacts.length} kontak berhasil dihapus`);
      setSelectedContacts([]);
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Normalize phone number
      let phone = formData.phone_number.replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      }

      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        device_id: "",
        name: formData.name,
        phone_number: phone,
        is_group: formData.is_group,
      });

      if (error) throw error;

      toast.success("Kontak berhasil ditambahkan");
      setAddDialogOpen(false);
      setFormData({ name: "", phone_number: "", is_group: false });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContact) return;

    try {
      let phone = formData.phone_number.replace(/\D/g, '');
      if (phone.startsWith('0')) {
        phone = '62' + phone.slice(1);
      }

      const { error } = await supabase
        .from("contacts")
        .update({
          name: formData.name,
          phone_number: phone,
          is_group: formData.is_group,
        })
        .eq("id", currentContact.id);

      if (error) throw error;

      toast.success("Kontak berhasil diperbarui");
      setEditDialogOpen(false);
      setCurrentContact(null);
      setFormData({ name: "", phone_number: "", is_group: false });
      fetchContacts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openEditDialog = (contact: Contact) => {
    setCurrentContact(contact);
    setFormData({
      name: contact.name || "",
      phone_number: contact.phone_number,
      is_group: contact.is_group,
    });
    setEditDialogOpen(true);
  };

  const handleExportContacts = () => {
    const csv = [
      ["Name", "Phone Number", "Type", "Members"],
      ...contacts.map((c) => [
        c.name || "",
        c.phone_number,
        c.is_group ? "Group" : "Individual",
        c.is_group && c.group_members ? c.group_members.length : 0,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    toast.success("Kontak berhasil diekspor");
  };

  const toggleSelectContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c.id));
    }
  };

  const handleSendMessage = (contact: Contact) => {
    // Navigate to broadcast with pre-selected contact
    navigate('/broadcast', { state: { selectedContact: contact } });
  };

  const stats = {
    total: contacts.length,
    groups: contacts.filter((c) => c.is_group).length,
    individuals: contacts.filter((c) => !c.is_group).length,
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Manajemen Kontak
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Kelola kontak individu dan grup untuk broadcast WhatsApp
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleExportContacts} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <ContactImport onImportComplete={fetchContacts} />
            <GroupManagement onGroupCreated={fetchContacts} />
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Manual
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Kontak Manual</DialogTitle>
                  <DialogDescription>
                    Tambahkan kontak baru secara manual
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddContact} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Nomor Telepon</Label>
                    <Input
                      id="phone"
                      value={formData.phone_number}
                      onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                      placeholder="08123456789 atau 628123456789"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Format: 08xxx atau 628xxx (otomatis dinormalisasi)
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_group"
                      checked={formData.is_group}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, is_group: checked as boolean })
                      }
                    />
                    <Label htmlFor="is_group">Ini adalah grup</Label>
                  </div>
                  <Button type="submit" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Tambah Kontak
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Kontak</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Kontak Individu</CardDescription>
              <CardTitle className="text-3xl">{stats.individuals}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Grup Kontak</CardDescription>
              <CardTitle className="text-3xl">{stats.groups}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <ContactFilter
          activeFilter={activeFilter}
          onFilterChange={(filter) => {
            setActiveFilter(filter);
            // Update URL params
            if (filter === 'all') {
              navigate('/contacts');
            } else {
              navigate(`/contacts?filter=${filter}`);
            }
          }}
          counts={{
            all: stats.total,
            groups: stats.groups,
            individuals: stats.individuals,
          }}
        />

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama atau nomor..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {selectedContacts.length > 0 && (
            <Button onClick={handleBulkDelete} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Hapus ({selectedContacts.length})
            </Button>
          )}
        </div>

        {filteredContacts.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
            <Checkbox
              checked={selectedContacts.length === filteredContacts.length}
              onCheckedChange={toggleSelectAll}
            />
            <Label className="cursor-pointer" onClick={toggleSelectAll}>
              {selectedContacts.length === filteredContacts.length
                ? `Semua ${filteredContacts.length} kontak dipilih`
                : `Pilih Semua (${filteredContacts.length})`}
            </Label>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Memuat kontak...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12">
            <Filter className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              {searchQuery || activeFilter !== "all"
                ? "Tidak ada kontak yang sesuai dengan filter"
                : "Belum ada kontak. Import atau tambahkan kontak baru"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredContacts.map((contact) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                selected={selectedContacts.includes(contact.id)}
                onSelect={() => toggleSelectContact(contact.id)}
                onEdit={() => openEditDialog(contact)}
                onDelete={() => handleDelete(contact.id)}
                onSendMessage={() => handleSendMessage(contact)}
                onUpdate={fetchContacts}
              />
            ))}
          </div>
        )}

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Kontak</DialogTitle>
              <DialogDescription>
                Perbarui informasi kontak
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditContact} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nama</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Nomor Telepon</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                  placeholder="628123456789"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-is_group"
                  checked={formData.is_group}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_group: checked as boolean })
                  }
                />
                <Label htmlFor="edit-is_group">Ini adalah grup</Label>
              </div>
              <Button type="submit" className="w-full">
                Update Kontak
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Contacts;
