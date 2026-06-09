import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/emploi-du-temps")({
  head: () => ({ meta: [{ title: "Emploi du temps — Techn301" }] }),
  component: TimetablePage,
});

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];

function TimetablePage() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useMyRoles(user?.id);
  const isStaff = hasRole(roles, "professeur") || hasRole(roles, "admin");
  const [classId, setClassId] = useState<string | null>(null);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("id,name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const effectiveClassId = classId ?? profile?.class_id ?? classes?.[0]?.id ?? null;

  const { data: slots, isLoading } = useQuery({
    queryKey: ["timetable", effectiveClassId],
    enabled: !!effectiveClassId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timetable_slots")
        .select("*, subjects(name,color), profiles(full_name)")
        .eq("class_id", effectiveClassId!)
        .order("start_time");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Emploi du temps"
        description="La semaine de la classe, créneau par créneau."
        action={
          <div className="flex items-center gap-2">
            {isStaff && classes && classes.length > 1 && (
              <Select value={effectiveClassId ?? undefined} onValueChange={setClassId}>
                <SelectTrigger className="glass-input w-40"><SelectValue placeholder="Classe" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {isStaff && effectiveClassId && <NewSlotDialog classId={effectiveClassId} />}
          </div>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-5">
          {DAYS.map((day, i) => {
            const daySlots = slots?.filter((s) => s.day_of_week === i + 1) ?? [];
            return (
              <section key={day} className="glass rounded-2xl p-3">
                <h2 className="mb-3 px-1 text-sm font-semibold">{day}</h2>
                {daySlots.length === 0 ? (
                  <p className="px-1 pb-2 text-xs text-muted-foreground">—</p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((s) => (
                      <SlotCard key={s.id} slot={s} canDelete={isStaff} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotCard({ slot, canDelete }: { slot: any; canDelete: boolean }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("timetable_slots").delete().eq("id", slot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Créneau supprimé.");
      qc.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: () => toast.error("Impossible de supprimer ce créneau. Vérifiez vos droits."),
  });

  const color = slot.subjects?.color ?? "#6366f1";
  return (
    <div className="group rounded-xl p-3" style={{ backgroundColor: `${color}18` }}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold" style={{ color }}>{slot.subjects?.name}</p>
        {canDelete && (
          <button
            onClick={() => del.mutate()}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="Supprimer le créneau"
          >
            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
      </p>
      {slot.room && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />{slot.room}
        </p>
      )}
      {slot.profiles?.full_name && <p className="mt-0.5 text-[11px] text-muted-foreground">{slot.profiles.full_name}</p>}
    </div>
  );
}

function NewSlotDialog({ classId }: { classId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("1");
  const [subjectId, setSubjectId] = useState("");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");
  const [room, setRoom] = useState("");

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
      if (!subjectId) throw new Error("Choisissez une matière.");
      if (start >= end) throw new Error("L'heure de fin doit être après l'heure de début.");
      const { error } = await supabase.from("timetable_slots").insert({
        class_id: classId,
        subject_id: subjectId,
        teacher_id: user?.id ?? null,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
        room: room.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Créneau ajouté à l'emploi du temps.");
      setOpen(false);
      setRoom("");
      qc.invalidateQueries({ queryKey: ["timetable"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur lors de l'ajout du créneau."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="size-4" />Ajouter</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouveau créneau</DialogTitle></DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Jour</Label>
              <Select value={day} onValueChange={setDay}>
                <SelectTrigger className="glass-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Label htmlFor="start">Début</Label>
              <Input id="start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className="glass-input" required />
            </div>
            <div>
              <Label htmlFor="end">Fin</Label>
              <Input id="end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="glass-input" required />
            </div>
          </div>
          <div>
            <Label htmlFor="room">Salle (facultatif)</Label>
            <Input id="room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={20} className="glass-input" placeholder="B204" />
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Ajouter le créneau
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}