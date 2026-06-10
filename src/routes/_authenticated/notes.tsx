import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Loader2, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({ meta: [{ title: "Notes — Techn301" }] }),
  component: NotesPage,
});

interface GradeRow {
  id: string;
  student_id: string;
  value: number;
  max_value: number;
  coefficient: number;
  label: string | null;
  date: string;
  subjects: { id: string; name: string; color: string } | null;
  profiles?: { full_name: string } | null;
}

function NotesPage() {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const isTeacher = hasRole(roles, "professeur") || hasRole(roles, "admin");
  const [share, setShare] = useState<GradeRow | null>(null);
  const [shareText, setShareText] = useState("");
  const [shareScope, setShareScope] = useState<"school" | "class">("class");
  const qc = useQueryClient();

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!user || !share) return;
      const { data: prof } = await supabase.from("profiles").select("class_id").eq("id", user.id).maybeSingle();
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: shareText.trim() || `J'ai partagé une note en ${share.subjects?.name ?? ""} !`,
        scope: shareScope,
        class_id: shareScope === "class" ? prof?.class_id ?? null : null,
        shared_grade_id: share.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note partagée sur le fil");
      qc.invalidateQueries({ queryKey: ["posts"] });
      setShare(null);
      setShareText("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const { data: grades, isLoading } = useQuery({
    queryKey: ["grades", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const q = supabase
        .from("grades")
        .select("id, student_id, value, max_value, coefficient, label, date, subjects(id,name,color), profiles!grades_student_profile_fkey(full_name)")
        .order("date", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as GradeRow[];
    },
  });

  // Group by subject for student view
  const mine = useMemo(() => grades?.filter((g) => g.student_id === user?.id) ?? [], [grades, user]);
  const bySubject = useMemo(() => {
    const map = new Map<string, { name: string; color: string; grades: GradeRow[] }>();
    mine.forEach((g) => {
      if (!g.subjects) return;
      const key = g.subjects.id;
      if (!map.has(key)) map.set(key, { name: g.subjects.name, color: g.subjects.color, grades: [] });
      map.get(key)!.grades.push(g);
    });
    return Array.from(map.entries()).map(([id, v]) => {
      const wsum = v.grades.reduce((a, g) => a + (g.value / g.max_value) * 20 * g.coefficient, 0);
      const csum = v.grades.reduce((a, g) => a + g.coefficient, 0);
      return { id, ...v, avg: csum > 0 ? wsum / csum : null };
    });
  }, [mine]);

  const general = useMemo(() => {
    const subs = bySubject.filter((s) => s.avg !== null);
    if (!subs.length) return null;
    return subs.reduce((a, s) => a + (s.avg ?? 0), 0) / subs.length;
  }, [bySubject]);

  return (
    <div>
      <PageHeader
        title="Notes & moyennes"
        description="Notes sur 20, moyennes par matière et moyenne générale auto-calculées."
        action={isTeacher && <NewGradeDialog />}
      />

      {!isTeacher && (
        <div className="glass mb-6 flex items-center gap-4 rounded-2xl p-6">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <GraduationCap className="size-7" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Moyenne générale</p>
            <p className="text-3xl font-semibold">{general !== null ? general.toFixed(2) : "—"}<span className="text-base text-muted-foreground"> /20</span></p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : !isTeacher ? (
        <div className="grid gap-3 md:grid-cols-2">
          {bySubject.length === 0 && (
            <div className="glass col-span-full rounded-2xl p-10 text-center text-sm text-muted-foreground">Aucune note pour l'instant.</div>
          )}
          {bySubject.map((s) => (
            <div key={s.id} className="glass rounded-2xl p-5">
              <header className="mb-3 flex items-center justify-between">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: `${s.color}20`, color: s.color }}>
                  {s.name}
                </span>
                <span className="text-lg font-semibold">{s.avg !== null ? s.avg.toFixed(2) : "—"}<span className="text-xs text-muted-foreground"> /20</span></span>
              </header>
              <ul className="space-y-1.5 text-sm">
                {s.grades.map((g) => (
                  <li key={g.id} className="flex items-center justify-between border-t border-border/60 pt-1.5 first:border-0 first:pt-0">
                    <span className="text-muted-foreground">{g.label || "Évaluation"} <span className="text-xs">×{g.coefficient}</span></span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{g.value}/{g.max_value}</span>
                      <button
                        onClick={() => setShare(g)}
                        className="text-muted-foreground transition-colors hover:text-primary"
                        aria-label="Partager"
                        title="Partager sur le fil"
                      >
                        <Share2 className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Élève</th>
                <th className="px-4 py-3">Matière</th>
                <th className="px-4 py-3">Évaluation</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Coef.</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {grades?.map((g) => (
                <tr key={g.id} className="border-t border-border/60">
                  <td className="px-4 py-3">{g.profiles?.full_name ?? "—"}</td>
                  <td className="px-4 py-3">{g.subjects?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.label ?? "—"}</td>
                  <td className="px-4 py-3 font-medium">{g.value}/{g.max_value}</td>
                  <td className="px-4 py-3">×{g.coefficient}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!share} onOpenChange={(o) => { if (!o) setShare(null); }}>
        <DialogContent className="glass-strong">
          <DialogHeader><DialogTitle>Partager cette note</DialogTitle></DialogHeader>
          {share && (
            <div className="space-y-3">
              <div className="rounded-xl bg-secondary/50 p-3 text-sm">
                <p className="font-semibold">{share.subjects?.name} — {share.label || "Évaluation"}</p>
                <p className="text-lg">{share.value}/{share.max_value}</p>
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  rows={3}
                  className="glass-input"
                  placeholder="Une appréciation à partager…"
                  value={shareText}
                  onChange={(e) => setShareText(e.target.value)}
                />
              </div>
              <div>
                <Label>Visibilité</Label>
                <Select value={shareScope} onValueChange={(v) => setShareScope(v as "school" | "class")}>
                  <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">Ma classe</SelectItem>
                    <SelectItem value="school">Tout l'établissement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShare(null)}>Annuler</Button>
            <Button onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending}>
              {shareMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Partager
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewGradeDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [value, setValue] = useState("");
  const [coef, setCoef] = useState("1");
  const [label, setLabel] = useState("");

  const { data: students } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      // Students = users with role 'eleve'
      const { data } = await supabase.from("user_roles").select("user_id, profiles:user_id(id, full_name)").eq("role", "eleve");
      return (data ?? []).map((r) => r.profiles).filter(Boolean) as { id: string; full_name: string }[];
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
      const { error } = await supabase.from("grades").insert({
        teacher_id: user.id,
        student_id: studentId,
        subject_id: subjectId,
        value: Number(value),
        coefficient: Number(coef),
        label: label || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note enregistrée");
      qc.invalidateQueries({ queryKey: ["grades"] });
      setOpen(false);
      setStudentId(""); setSubjectId(""); setValue(""); setCoef("1"); setLabel("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" />Saisir une note</Button></DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouvelle note</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div>
            <Label>Élève</Label>
            <Select value={studentId} onValueChange={setStudentId} required>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
              <SelectContent>{students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 8)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Matière</Label>
            <Select value={subjectId} onValueChange={setSubjectId} required>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
              <SelectContent>{subjects?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="g-val">Note /20</Label>
              <Input id="g-val" type="number" min="0" max="20" step="0.25" required value={value} onChange={(e) => setValue(e.target.value)} className="glass-input" />
            </div>
            <div>
              <Label htmlFor="g-coef">Coefficient</Label>
              <Input id="g-coef" type="number" min="0.5" step="0.5" required value={coef} onChange={(e) => setCoef(e.target.value)} className="glass-input" />
            </div>
          </div>
          <div>
            <Label htmlFor="g-label">Intitulé (DS1, contrôle…)</Label>
            <Input id="g-label" value={label} onChange={(e) => setLabel(e.target.value)} className="glass-input" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending || !studentId || !subjectId}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
