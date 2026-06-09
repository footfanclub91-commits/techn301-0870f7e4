import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/discipline")({
  head: () => ({ meta: [{ title: "Vie scolaire — Techn301" }] }),
  component: Page,
});

const severityColor = { mineur: "text-success", moyen: "text-warning", grave: "text-destructive" } as const;

function Page() {
  const { data: incidents, isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*, student:profiles!incidents_student_profile_fkey(full_name), author:profiles!incidents_author_profile_fkey(full_name)")
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader title="Vie scolaire" description="Suivi des incidents et observations disciplinaires." action={<NewIncidentDialog />} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : incidents?.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Aucun incident enregistré.</div>
      ) : (
        <div className="space-y-3">
          {incidents?.map((i) => (
            <article key={i.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className={`flex items-center gap-2 text-xs font-medium ${severityColor[i.severity as keyof typeof severityColor]}`}>
                    <AlertTriangle className="size-3.5" /> {i.severity}
                  </div>
                  <h3 className="mt-1 text-base font-semibold">{i.motif}</h3>
                  <p className="text-xs text-muted-foreground">
                    Élève&nbsp;: {i.student?.full_name ?? "—"} • Par {i.author?.full_name ?? "—"} • {format(new Date(i.date), "d MMM yyyy", { locale: fr })}
                  </p>
                  {i.description && <p className="mt-2 text-sm">{i.description}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function NewIncidentDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [motif, setMotif] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"mineur" | "moyen" | "grave">("mineur");

  const { data: students } = useQuery({
    queryKey: ["students-list"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, profiles:user_id(id, full_name)").eq("role", "eleve");
      return (data ?? []).map((r) => r.profiles).filter(Boolean) as { id: string; full_name: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("incidents").insert({
        author_id: user.id, student_id: studentId, motif, description: description || null, severity,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident enregistré");
      qc.invalidateQueries({ queryKey: ["incidents"] });
      setOpen(false); setStudentId(""); setMotif(""); setDescription(""); setSeverity("mineur");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" />Déclarer un incident</Button></DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouvel incident</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div>
            <Label>Élève</Label>
            <Select value={studentId} onValueChange={setStudentId} required>
              <SelectTrigger className="glass-input"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.id.slice(0, 8)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="i-mot">Motif</Label>
            <Input id="i-mot" required value={motif} onChange={(e) => setMotif(e.target.value)} className="glass-input" />
          </div>
          <div>
            <Label>Gravité</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as "mineur" | "moyen" | "grave")}>
              <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mineur">Mineur</SelectItem>
                <SelectItem value="moyen">Moyen</SelectItem>
                <SelectItem value="grave">Grave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="i-desc">Description</Label>
            <Textarea id="i-desc" value={description} onChange={(e) => setDescription(e.target.value)} className="glass-input" rows={3} />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending || !studentId}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
