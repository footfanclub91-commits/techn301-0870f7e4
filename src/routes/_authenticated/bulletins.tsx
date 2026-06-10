import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Loader2, Download, Eye, Pencil, Trash2, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/bulletins")({
  head: () => ({ meta: [{ title: "Bulletins — Techn301" }] }),
  component: BulletinsPage,
});

type SubjectLine = { subject: string; teacher?: string; average?: string; appreciation?: string };
type Bulletin = {
  id: string;
  student_id: string;
  author_id: string;
  period: string;
  general_appreciation: string | null;
  subjects: SubjectLine[];
  published: boolean;
  created_at: string;
  updated_at: string;
};

function BulletinsPage() {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const isStaff = hasRole(roles, "professeur") || hasRole(roles, "admin") || hasRole(roles, "cpe");

  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Bulletin> | null>(null);
  const [viewing, setViewing] = useState<Bulletin | null>(null);

  const { data: bulletins, isLoading } = useQuery({
    queryKey: ["bulletins", user?.id, isStaff],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bulletins")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Bulletin[];
    },
  });

  const { data: profilesById } = useQuery({
    queryKey: ["profiles-min"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      const map = new Map<string, string>();
      (data ?? []).forEach((p) => map.set(p.id, p.full_name));
      return map;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bulletins").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bulletin supprimé");
      qc.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: () => toast.error("Suppression impossible."),
  });

  const togglePublished = useMutation({
    mutationFn: async (b: Bulletin) => {
      const { error } = await supabase.from("bulletins").update({ published: !b.published }).eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bulletins"] }),
    onError: () => toast.error("Action impossible."),
  });

  return (
    <div>
      <PageHeader
        title="Bulletins"
        description={isStaff ? "Rédige les bulletins et publie-les pour les élèves." : "Consulte tes bulletins de trimestre."}
        action={isStaff && (
          <Button className="gap-2" onClick={() => setEditing({ period: "Trimestre 1", subjects: [], general_appreciation: "", published: false })}>
            <Plus className="size-4" />Nouveau bulletin
          </Button>
        )}
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : !bulletins || bulletins.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {isStaff ? "Aucun bulletin créé pour l'instant." : "Aucun bulletin publié pour le moment."}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {bulletins.map((b) => (
            <article key={b.id} className="glass rounded-2xl p-5">
              <header className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="size-3.5" />
                    {b.period}
                  </div>
                  <h3 className="text-base font-semibold">{profilesById?.get(b.student_id) ?? "Élève"}</h3>
                  <p className="text-xs text-muted-foreground">
                    Par {profilesById?.get(b.author_id) ?? "—"} • {format(new Date(b.created_at), "d MMM yyyy", { locale: fr })}
                  </p>
                </div>
                {isStaff && (
                  <button
                    onClick={() => togglePublished.mutate(b)}
                    className="flex items-center gap-1 text-xs"
                    title="Publier / dépublier"
                  >
                    {b.published ? (
                      <><CheckCircle2 className="size-3.5 text-emerald-500" /> Publié</>
                    ) : (
                      <><Circle className="size-3.5 text-muted-foreground" /> Brouillon</>
                    )}
                  </button>
                )}
              </header>
              {b.general_appreciation && (
                <p className="line-clamp-3 text-sm text-muted-foreground">{b.general_appreciation}</p>
              )}
              <footer className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setViewing(b)}>
                  <Eye className="size-3.5" />Voir
                </Button>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => exportPdf(b, profilesById?.get(b.student_id) ?? "Élève")}>
                  <Download className="size-3.5" />PDF
                </Button>
                {isStaff && (b.author_id === user?.id || hasRole(roles, "admin")) && (
                  <>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setEditing(b)}>
                      <Pencil className="size-3.5" />Modifier
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => remove.mutate(b.id)}>
                      <Trash2 className="size-3.5" />Supprimer
                    </Button>
                  </>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <EditDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["bulletins"] });
          }}
        />
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null); }}>
        <DialogContent className="glass-strong max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {viewing && (
            <>
              <DialogHeader>
                <DialogTitle>{viewing.period} — {profilesById?.get(viewing.student_id) ?? ""}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/50 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Matière</th>
                        <th className="px-3 py-2">Prof.</th>
                        <th className="px-3 py-2">Moy.</th>
                        <th className="px-3 py-2">Appréciation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewing.subjects.map((s, i) => (
                        <tr key={i} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 font-medium">{s.subject}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.teacher || "—"}</td>
                          <td className="px-3 py-2">{s.average || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.appreciation || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {viewing.general_appreciation && (
                  <div className="rounded-xl bg-secondary/50 p-4">
                    <p className="text-xs uppercase text-muted-foreground">Appréciation générale</p>
                    <p className="mt-1 text-sm">{viewing.general_appreciation}</p>
                  </div>
                )}
                <Button className="w-full gap-2" onClick={() => exportPdf(viewing, profilesById?.get(viewing.student_id) ?? "Élève")}>
                  <Download className="size-4" />Télécharger en PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Bulletin>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState(initial.student_id ?? "");
  const [period, setPeriod] = useState(initial.period ?? "Trimestre 1");
  const [general, setGeneral] = useState(initial.general_appreciation ?? "");
  const [subjects, setSubjects] = useState<SubjectLine[]>(initial.subjects ?? []);
  const [published, setPublished] = useState(initial.published ?? false);

  const { data: students } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, profiles:user_id(id, full_name)").eq("role", "eleve");
      return (data ?? []).map((r) => r.profiles).filter(Boolean) as { id: string; full_name: string }[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non authentifié");
      if (!studentId) throw new Error("Sélectionne un élève");
      const payload = {
        student_id: studentId,
        author_id: user.id,
        period,
        general_appreciation: general || null,
        subjects: subjects as unknown as import("@/integrations/supabase/types").Json,
        published,
      };
      if (initial.id) {
        const { error } = await supabase.from("bulletins").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bulletins").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Bulletin enregistré");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const updateSubject = (i: number, patch: Partial<SubjectLine>) => {
    setSubjects((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Modifier le bulletin" : "Nouveau bulletin"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Élève</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Période</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Trimestre 1">Trimestre 1</SelectItem>
                  <SelectItem value="Trimestre 2">Trimestre 2</SelectItem>
                  <SelectItem value="Trimestre 3">Trimestre 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Matières</Label>
              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={() => setSubjects((a) => [...a, { subject: "", teacher: "", average: "", appreciation: "" }])}>
                <Plus className="size-3.5" />Ajouter
              </Button>
            </div>
            <div className="space-y-2">
              {subjects.length === 0 && (
                <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Ajoute une ligne par matière.
                </p>
              )}
              {subjects.map((s, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-border/60 p-3 sm:grid-cols-12">
                  <Input className="glass-input sm:col-span-3" placeholder="Matière" value={s.subject} onChange={(e) => updateSubject(i, { subject: e.target.value })} />
                  <Input className="glass-input sm:col-span-3" placeholder="Professeur" value={s.teacher ?? ""} onChange={(e) => updateSubject(i, { teacher: e.target.value })} />
                  <Input className="glass-input sm:col-span-1" placeholder="Moy." value={s.average ?? ""} onChange={(e) => updateSubject(i, { average: e.target.value })} />
                  <Input className="glass-input sm:col-span-4" placeholder="Appréciation" value={s.appreciation ?? ""} onChange={(e) => updateSubject(i, { appreciation: e.target.value })} />
                  <Button type="button" variant="ghost" size="sm" className="text-destructive sm:col-span-1" onClick={() => setSubjects((arr) => arr.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Appréciation générale</Label>
            <Textarea rows={3} className="glass-input" value={general} onChange={(e) => setGeneral(e.target.value)} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Publier (visible par l'élève)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportPdf(b: Bulletin, studentName: string) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Techn301 — Bulletin scolaire", 14, 18);
  doc.setFontSize(11);
  doc.text(`Élève : ${studentName}`, 14, 28);
  doc.text(`Période : ${b.period}`, 14, 34);
  doc.text(`Date : ${format(new Date(b.created_at), "d MMMM yyyy", { locale: fr })}`, 14, 40);

  autoTable(doc, {
    startY: 48,
    head: [["Matière", "Professeur", "Moyenne", "Appréciation"]],
    body: (b.subjects ?? []).map((s) => [s.subject, s.teacher ?? "", s.average ?? "", s.appreciation ?? ""]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [99, 102, 241] },
  });

  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  const y = (last?.finalY ?? 80) + 10;
  if (b.general_appreciation) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Appréciation générale", 14, y);
    doc.setFont("helvetica", "normal");
    const split = doc.splitTextToSize(b.general_appreciation, 180);
    doc.text(split, 14, y + 6);
  }

  doc.save(`bulletin-${studentName.replace(/\s+/g, "_")}-${b.period.replace(/\s+/g, "_")}.pdf`);
}
