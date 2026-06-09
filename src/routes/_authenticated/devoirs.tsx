import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Calendar, Loader2 } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/devoirs")({
  head: () => ({ meta: [{ title: "Devoirs — Techn301" }] }),
  component: DevoirsPage,
});

function DevoirsPage() {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const canCreate = hasRole(roles, "professeur") || hasRole(roles, "admin");

  const { data: homework, isLoading } = useQuery({
    queryKey: ["homework"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("homework")
        .select("*, subjects(name,color), classes(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Devoirs"
        description="À faire, rendus ou en retard — toute ta liste centralisée."
        action={canCreate && <NewHomeworkDialog />}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : homework?.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Aucun devoir programmé.
        </div>
      ) : (
        <div className="grid gap-3">
          {homework?.map((h) => {
            const due = new Date(h.due_date);
            const status = isPast(due) && !isToday(due) ? "retard" : isToday(due) ? "aujourdhui" : "afaire";
            const statusColor =
              status === "retard"
                ? "text-destructive"
                : status === "aujourdhui"
                  ? "text-warning"
                  : "text-success";
            return (
              <article key={h.id} className="glass rounded-2xl p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="rounded-full px-2 py-0.5 font-medium"
                        style={{ backgroundColor: `${h.subjects?.color ?? "#6366f1"}20`, color: h.subjects?.color ?? "#6366f1" }}
                      >
                        {h.subjects?.name}
                      </span>
                      <span className="text-muted-foreground">{h.classes?.name}</span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold">{h.title}</h3>
                    {h.description && <p className="mt-1 text-sm text-muted-foreground">{h.description}</p>}
                  </div>
                  <div className={`flex items-center gap-1.5 text-xs font-medium ${statusColor}`}>
                    <Calendar className="size-3.5" />
                    {format(due, "EEE d MMM", { locale: fr })}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewHomeworkDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, name").order("name");
      return data ?? [];
    },
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects-list"],
    queryFn: async () => {
      const { data } = await supabase.from("subjects").select("id, name").order("name");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("homework").insert({
        teacher_id: user.id,
        class_id: classId,
        subject_id: subjectId,
        title,
        description: description || null,
        due_date: dueDate,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devoir créé");
      qc.invalidateQueries({ queryKey: ["homework"] });
      setOpen(false);
      setTitle(""); setDescription(""); setDueDate(""); setClassId(""); setSubjectId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="size-4" />Nouveau devoir</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-glass-border">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BookOpen className="size-5" />Nouveau devoir</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="space-y-4"
        >
          <div>
            <Label>Classe</Label>
            <Select value={classId} onValueChange={setClassId} required>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir une classe" /></SelectTrigger>
              <SelectContent>{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Matière</Label>
            <Select value={subjectId} onValueChange={setSubjectId} required>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
              <SelectContent>{subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="hw-title">Titre</Label>
            <Input id="hw-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="glass-input" />
          </div>
          <div>
            <Label htmlFor="hw-desc">Description</Label>
            <Textarea id="hw-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="glass-input" rows={3} />
          </div>
          <div>
            <Label htmlFor="hw-due">Date limite</Label>
            <Input id="hw-due" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="glass-input" />
          </div>
          <Button type="submit" disabled={create.isPending || !classId || !subjectId} className="w-full">
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Créer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
