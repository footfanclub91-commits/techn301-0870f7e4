import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users, School, BookOpen, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administration — Techn301" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const { data: roles, isLoading: rolesLoading } = useMyRoles(user?.id);

  if (rolesLoading) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin" /></div>;
  if (!hasRole(roles, "admin")) {
    throw redirect({ to: "/feed" });
  }

  return (
    <div>
      <PageHeader title="Administration" description="Gestion des utilisateurs, classes et matières." />
      <Stats />
      <Tabs defaultValue="users" className="mt-6">
        <TabsList className="glass">
          <TabsTrigger value="users" className="gap-2"><Users className="size-4" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="classes" className="gap-2"><School className="size-4" />Classes</TabsTrigger>
          <TabsTrigger value="subjects" className="gap-2"><BookOpen className="size-4" />Matières</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><UsersTab /></TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesTab /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function Stats() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [u, c, s, p] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
        supabase.from("subjects").select("id", { count: "exact", head: true }),
        supabase.from("posts").select("id", { count: "exact", head: true }),
      ]);
      return { users: u.count ?? 0, classes: c.count ?? 0, subjects: s.count ?? 0, posts: p.count ?? 0 };
    },
  });
  const items = [
    { label: "Utilisateurs", value: data?.users },
    { label: "Classes", value: data?.classes },
    { label: "Matières", value: data?.subjects },
    { label: "Publications", value: data?.posts },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="glass rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</p>
          <p className="mt-1 text-2xl font-semibold">{it.value ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("*, classes(name)").order("full_name");
      const { data: rolesData } = await supabase.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, string[]>();
      rolesData?.forEach((r) => {
        if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
        rolesByUser.get(r.user_id)!.push(r.role);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin"|"professeur"|"eleve"|"cpe" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      await supabase.from("user_roles").insert({ user_id: userId, role });
    },
    onSuccess: () => { toast.success("Rôle mis à jour"); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const setClass = useMutation({
    mutationFn: async ({ userId, classId }: { userId: string; classId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ class_id: classId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
          <tr><th className="px-4 py-3">Nom</th><th className="px-4 py-3">Rôle</th><th className="px-4 py-3">Classe</th></tr>
        </thead>
        <tbody>
          {users?.map((u) => (
            <tr key={u.id} className="border-t border-border/60">
              <td className="px-4 py-3 font-medium">{u.full_name || u.id.slice(0, 8)}</td>
              <td className="px-4 py-3">
                <Select value={u.roles[0] ?? "eleve"} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as "admin"|"professeur"|"eleve"|"cpe" })}>
                  <SelectTrigger className="glass-input h-8 w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="professeur">Professeur</SelectItem>
                    <SelectItem value="cpe">Vie scolaire</SelectItem>
                    <SelectItem value="eleve">Élève</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="px-4 py-3">
                <Select value={u.class_id ?? "none"} onValueChange={(v) => setClass.mutate({ userId: u.id, classId: v === "none" ? null : v })}>
                  <SelectTrigger className="glass-input h-8 w-44"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClassesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({ name, level: level || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Classe créée"); qc.invalidateQueries({ queryKey: ["classes-list"] }); setOpen(false); setName(""); setLevel(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("classes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["classes-list"] }),
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" />Nouvelle classe</Button></DialogTrigger>
          <DialogContent className="glass-strong">
            <DialogHeader><DialogTitle>Nouvelle classe</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
              <div><Label>Nom (ex. 3ème B)</Label><Input required value={name} onChange={(e) => setName(e.target.value)} className="glass-input" /></div>
              <div><Label>Niveau</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="Collège, Lycée…" className="glass-input" /></div>
              <Button type="submit" className="w-full" disabled={create.isPending}>Créer</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {classes?.map((c) => (
          <div key={c.id} className="glass flex items-center justify-between rounded-2xl p-4">
            <div><p className="font-medium">{c.name}</p>{c.level && <p className="text-xs text-muted-foreground">{c.level}</p>}</div>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(c.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  const { data: subjects } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("subjects").insert({ name, color }); if (error) throw error; },
    onSuccess: () => { toast.success("Matière ajoutée"); qc.invalidateQueries({ queryKey: ["subjects-list"] }); setName(""); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("subjects").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subjects-list"] }),
  });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="glass mb-4 flex flex-wrap items-end gap-3 rounded-2xl p-4">
        <div className="flex-1 min-w-[180px]"><Label>Nom</Label><Input required value={name} onChange={(e) => setName(e.target.value)} className="glass-input" /></div>
        <div><Label>Couleur</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="glass-input h-10 w-20 p-1" /></div>
        <Button type="submit"><Plus className="size-4" />Ajouter</Button>
      </form>
      <div className="grid gap-2 md:grid-cols-3">
        {subjects?.map((s) => (
          <div key={s.id} className="glass flex items-center justify-between rounded-xl p-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className="size-3 rounded-full" style={{ backgroundColor: s.color ?? "#6366f1" }} />{s.name}
            </span>
            <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
