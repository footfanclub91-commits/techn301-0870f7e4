import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/appel")({
  head: () => ({ meta: [{ title: "Liste d'appel — Techn301" }] }),
  component: AppelPage,
});

type Category =
  | "bavardages"
  | "oubli_materiel"
  | "travail_non_fait"
  | "refus_travail"
  | "insolence"
  | "comportement_irrespectueux"
  | "encouragement";

const CATEGORIES: { value: Category; label: string; color: string; positive?: boolean }[] = [
  { value: "bavardages", label: "Bavardages", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25" },
  { value: "oubli_materiel", label: "Oubli matériel", color: "bg-orange-500/15 text-orange-600 dark:text-orange-400 hover:bg-orange-500/25" },
  { value: "travail_non_fait", label: "Travail non fait", color: "bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25" },
  { value: "refus_travail", label: "Refus de travail", color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25" },
  { value: "insolence", label: "Insolence", color: "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400 hover:bg-fuchsia-500/25" },
  { value: "comportement_irrespectueux", label: "Comportement irrespectueux", color: "bg-purple-500/15 text-purple-600 dark:text-purple-400 hover:bg-purple-500/25" },
  { value: "encouragement", label: "Encouragement", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25", positive: true },
];

function categoryMeta(c: Category) {
  return CATEGORIES.find((x) => x.value === c)!;
}

function AppelPage() {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const canEdit = hasRole(roles, "professeur") || hasRole(roles, "admin") || hasRole(roles, "cpe");

  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState<{ studentId: string; category: Category } | null>(null);
  const [message, setMessage] = useState("");

  const qc = useQueryClient();

  const { data: classes } = useQuery({
    queryKey: ["classes-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id, name, level").order("name");
      if (error) throw error;
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

  const { data: students } = useQuery({
    queryKey: ["students-of-class", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("class_id", classId)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: entries } = useQuery({
    queryKey: ["call-entries", classId, date],
    enabled: !!classId && !!date,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_entries")
        .select("*")
        .eq("class_id", classId)
        .eq("date", date)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const byStudent = useMemo(() => {
    const m = new Map<string, typeof entries>();
    (entries ?? []).forEach((e) => {
      const arr = m.get(e.student_id) ?? [];
      arr.push(e);
      m.set(e.student_id, arr);
    });
    return m;
  }, [entries]);

  const addEntry = useMutation({
    mutationFn: async ({ studentId, category, msg }: { studentId: string; category: Category; msg: string }) => {
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("call_entries").insert({
        teacher_id: user.id,
        student_id: studentId,
        class_id: classId || null,
        subject_id: subjectId || null,
        category,
        message: msg.trim() || null,
        date,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée enregistrée");
      qc.invalidateQueries({ queryKey: ["call-entries"] });
      setPending(null);
      setMessage("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const removeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("call_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée supprimée");
      qc.invalidateQueries({ queryKey: ["call-entries"] });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  if (!canEdit) {
    return (
      <div>
        <PageHeader title="Liste d'appel" />
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Réservé aux enseignants et à la vie scolaire.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Liste d'appel"
        description="Tagger rapidement les comportements et encouragements pendant le cours."
      />

      <div className="glass mb-4 grid gap-3 rounded-2xl p-4 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Classe</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir la classe" /></SelectTrigger>
            <SelectContent>
              {classes?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}{c.level ? ` — ${c.level}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Matière (optionnel)</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="glass-input"><SelectValue placeholder="Matière" /></SelectTrigger>
            <SelectContent>
              {subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="glass-input" />
        </div>
      </div>

      {!classId ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Sélectionne une classe pour afficher la liste.
        </div>
      ) : !students || students.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Aucun élève rattaché à cette classe.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Actions rapides</th>
                <th className="px-4 py-3">Aujourd'hui ({format(new Date(date), "d MMM", { locale: fr })})</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const list = byStudent.get(s.id) ?? [];
                return (
                  <tr key={s.id} className="border-t border-border/60 align-top">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{i + 1}.</span>
                        <span className="font-medium">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => { setPending({ studentId: s.id, category: c.value }); setMessage(""); }}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${c.color}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {list.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <ul className="space-y-1">
                          {list.map((e) => {
                            const meta = categoryMeta(e.category as Category);
                            return (
                              <li key={e.id} className="flex items-start gap-2 text-xs">
                                <span className={`rounded-full px-2 py-0.5 font-medium ${meta.color}`}>{meta.label}</span>
                                {e.message && <span className="text-muted-foreground">— {e.message}</span>}
                                {e.teacher_id === user?.id && (
                                  <button onClick={() => removeEntry.mutate(e.id)} aria-label="Supprimer">
                                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="size-4" />
              {pending ? categoryMeta(pending.category).label : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="msg">Message (optionnel)</Label>
            <Textarea
              id="msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder={pending?.category === "encouragement" ? "Bravo pour…" : "Précision, contexte…"}
              className="glass-input"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPending(null)}>Annuler</Button>
            <Button
              disabled={addEntry.isPending}
              onClick={() => pending && addEntry.mutate({ studentId: pending.studentId, category: pending.category, msg: message })}
            >
              {addEntry.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
