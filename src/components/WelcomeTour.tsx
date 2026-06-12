import { useEffect, useState } from "react";
import { Sparkles, MessageSquare, CalendarDays, BookOpen, GraduationCap, Users, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "techn301:welcome-seen:";

const steps = [
  {
    icon: Sparkles,
    title: "Bienvenue sur Techn301 👋",
    body: "Ta plateforme de vie scolaire : fil d'actualité, devoirs, notes, emploi du temps et messagerie — réunis au même endroit.",
  },
  {
    icon: MessageSquare,
    title: "Reste connecté à la classe",
    body: "Publie sur le fil, like et commente les posts, partage tes notes et discute en direct via la messagerie.",
  },
  {
    icon: CalendarDays,
    title: "Organise ta semaine",
    body: "Consulte ton emploi du temps, le cahier de textes et la liste des devoirs à rendre, sans rien oublier.",
  },
  {
    icon: GraduationCap,
    title: "Suis tes résultats",
    body: "Notes, appréciations et bulletins en un coup d'œil — avec export PDF des bulletins.",
  },
  {
    icon: Users,
    title: "Personnalise ton profil",
    body: "Ajoute ta photo, ta bannière et une présentation. Tu peux changer ton mot de passe à tout moment.",
  },
];

export function WelcomeTour({ userId }: { userId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!userId) return;
    try {
      if (!localStorage.getItem(STORAGE_PREFIX + userId)) setOpen(true);
    } catch {}
  }, [userId]);

  function close() {
    if (userId) {
      try { localStorage.setItem(STORAGE_PREFIX + userId, "1"); } catch {}
    }
    setOpen(false);
  }

  const s = steps[step];
  const Icon = s.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
          <DialogTitle>{s.title}</DialogTitle>
          <DialogDescription>{s.body}</DialogDescription>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" onClick={close}>Passer</Button>
          {isLast ? (
            <Button onClick={close} className="gap-2">C'est parti <BookOpen className="size-4" /></Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} className="gap-2">
              Suivant <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}