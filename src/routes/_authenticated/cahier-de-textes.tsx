import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, NotebookPen, BookOpen } from "lucide-react";
import { format } from "date-fns";
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

export const Route = createFileRoute("/_authenticated/cahier-de-textes")({
  head: () => ({ meta: [{ title: "Cahier de textes — Techn301" }] }),
  component: CahierPage,
});

function CahierPage() {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const canWrite = hasRole(roles, "professeur") || hasRole(roles, "admin");

  const { data: lessons, isLoading } = useQuery({
    queryKey: ["lessons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lessons")
        .select("*, subjects(name,color), classes(name), profiles(full_name)")
        .order("lesson_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dates = [...new Set((lessons ?? []).map((l) => l.lesson_date))];

  return (
    <div>
      <PageHeader
        title="Cahier de textes"
        description="Le contenu des séances et le travail à faire, jour par jour."
        action={canWrite && <NewLessonDialog />}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : lessons?.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Le cahier de textes est vide pour l'instant.
        </div>
      ) : (
        <div className="space-y-6">
          {dates.map((date) => (
            <section key={date}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-muted-foreground">
                {format(new Date(date), "EEEE d MMMM yyyy", { locale: fr })}
              </h2>
              <div className="grid gap-3">
                {lessons!
                  .filter((l) => l.lesson_date === date)
                  .map((l) => (
                    <LessonCard key={l.id} lesson={l} canDelete={canWrite && l.teacher_id === user?.id} isAdmin={hasRole(roles, "admin")} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({ lesson, canDelete, isAdmin }: { lesson: any; canDelete: boolean; isAdmin: boolean }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée supprimée du cahier de textes.");
      qc.invalidateQueries({ queryKey: ["lessons"] });
    },
    onError: () => toast.error("Suppression impossible : vous ne pouvez supprimer que vos propres entrées."),
  });

  const color = lesson.subjects?.color ?? "#6366f1";
  return (
    <article className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full px-2 py-0.5 font-medium" style={{ backgroundColor: `${color}20`, color }}>
            {lesson.subjects?.name}
          </span>
          <span className="text-muted-foreground">{lesson.classes?.name}</span>
          <span className="text-muted-foreground">· {lesson.profiles?.full_name}</span>
        </div>
        {(canDelete || isAdmin) && (
          <button onClick={() => del.mutate()} aria-label="Supprimer l'entrée">
            <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
      <div className="mt-3 space-y-3 text-sm">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <NotebookPen className="size-3.5" /> Contenu de la séance
          </p>
          <p className="whitespace-pre-wrap leading-relaxed">{lesson.content}</p>
        </div>
        {lesson.homework && (
          <div className="rounded-xl bg-primary/5 p-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
              <BookOpen className="size-3.5" /> Travail à faire
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{lesson.homework}</p>
          </div>
        )}
      </div>
    </article>
  );
}

function NewLessonDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [content, setContent] = useState("");
  const [homework, setHomework] = useState("");

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!classId || !subjectId) throw new Error("Choisissez une classe et une matière.");
      if (!content.trim()) throw new Error("Décrivez le contenu de la séance.");
      const { error } = await supabase.from("lessons").insert({
        class_id: classId,
        subject_id: subjectId,
        teacher_id: user!.id,
        lesson_date: date,
        content: content.trim(),
        homework: homework.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée ajoutée au cahier de textes.");
      setOpen(false);
      setContent("");
      setHomework("");
      qc.invalidateQueries({ queryKey: ["lessons"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="size-4" />Nouvelle entrée</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouvelle entrée au cahier de textes</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ldate">Date</Label>
              <Input id="ldate" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glass-input" required />
            </div>
            <div>
              <Label>Classe</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                <SelectContent>
                  {classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Matière</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="lcontent">Contenu de la séance</Label>
            <Textarea id="lcontent" value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} className="glass-input resize-none" required />
          </div>
          <div>
            <Label htmlFor="lhw">Travail à faire (facultatif)</Label>
            <Textarea id="lhw" value={homework} onChange={(e) => setHomework(e.target.value)} rows={2} maxLength={1000} className="glass-input resize-none" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Publier au cahier de textes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}