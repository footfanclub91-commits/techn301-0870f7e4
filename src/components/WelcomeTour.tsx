import { useEffect, useState } from "react";
import {
  Sparkles,
  MessageSquare,
  CalendarDays,
  BookOpen,
  GraduationCap,
  Users,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Heart,
  FileText,
  ClipboardCheck,
  Bell,
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "techn301:welcome-seen-v2:";

type Step = {
  icon: typeof Sparkles;
  emoji: string;
  title: string;
  body: string;
  bullets?: string[];
  gradient: string;
};

const steps: Step[] = [
  {
    icon: Sparkles,
    emoji: "👋",
    title: "Bienvenue sur Techn301",
    body: "La plateforme de vie scolaire de ta classe. Tout ce dont tu as besoin — réuni au même endroit.",
    bullets: ["Fil d'actualité de la classe", "Devoirs, notes & bulletins", "Messagerie & emploi du temps"],
    gradient: "from-indigo-500/30 via-fuchsia-500/20 to-rose-500/20",
  },
  {
    icon: MessageSquare,
    emoji: "💬",
    title: "Vis la classe en temps réel",
    body: "Le fil d'actualité, c'est le mur de la classe : publie, like, commente, partage.",
    bullets: ["Crée des posts avec photos", "Like ❤️ & commente", "Partage tes meilleures notes", "Conversations privées ou de groupe"],
    gradient: "from-rose-500/30 via-orange-500/20 to-amber-500/20",
  },
  {
    icon: CalendarDays,
    emoji: "🗓️",
    title: "Organise ta semaine",
    body: "Plus jamais d'oubli : tout l'emploi du temps et le travail à rendre à portée de main.",
    bullets: ["Emploi du temps en grille", "Cahier de textes par cours", "Devoirs avec date de rendu"],
    gradient: "from-sky-500/30 via-cyan-500/20 to-emerald-500/20",
  },
  {
    icon: GraduationCap,
    emoji: "📊",
    title: "Suis tes résultats",
    body: "Notes, appréciations et bulletins en un coup d'œil — avec export PDF.",
    bullets: ["Moyenne par matière", "Bulletins trimestriels", "Téléchargement PDF officiel"],
    gradient: "from-emerald-500/30 via-teal-500/20 to-sky-500/20",
  },
  {
    icon: ClipboardCheck,
    emoji: "✅",
    title: "Vie scolaire & comportement",
    body: "Les profs notent encouragements et incidents. Tu vois tout sur ton profil.",
    bullets: ["Encouragements 🌟", "Suivi des incidents", "Communication directe avec la vie scolaire"],
    gradient: "from-violet-500/30 via-purple-500/20 to-pink-500/20",
  },
  {
    icon: Users,
    emoji: "🎨",
    title: "Ton profil, ton style",
    body: "Personnalise ta page : photo, bannière (même un GIF !), présentation.",
    bullets: ["Avatar & bannière", "Bio personnalisée", "Mode clair / sombre"],
    gradient: "from-amber-500/30 via-yellow-500/20 to-orange-500/20",
  },
  {
    icon: Rocket,
    emoji: "🚀",
    title: "Prêt(e) à décoller ?",
    body: "C'est tout pour la visite ! Tu peux la relancer depuis ton profil quand tu veux.",
    bullets: ["Astuce : explore l'annuaire pour voir le profil de tes camarades"],
    gradient: "from-primary/40 via-fuchsia-500/20 to-cyan-500/20",
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
    setStep(0);
  }

  const s = steps[step];
  const Icon = s.icon;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
      <DialogContent className="max-w-lg overflow-hidden p-0 border-0">
        {/* Hero gradient header */}
        <div className={`relative bg-gradient-to-br ${s.gradient} px-8 pt-8 pb-6`}>
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]" aria-hidden />
          <div className="relative flex items-start justify-between">
            <div
              key={step}
              className="flex size-16 items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm text-primary shadow-lg animate-float-in"
            >
              <Icon className="size-8" strokeWidth={2} />
            </div>
            <span className="text-5xl animate-float-in" aria-hidden>{s.emoji}</span>
          </div>
          <h2 className="mt-5 text-2xl font-bold leading-tight text-foreground animate-float-in">
            {s.title}
          </h2>
          <p className="mt-2 text-sm text-foreground/80 animate-float-in">{s.body}</p>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {s.bullets && (
            <ul className="space-y-2.5">
              {s.bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-sm text-foreground/90 animate-float-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Progress */}
          <div className="mt-6">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Étape {step + 1} / {steps.length}</span>
              <button onClick={close} className="hover:text-foreground transition-colors">Passer la visite</button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={isFirst}
              className="gap-2"
            >
              <ArrowLeft className="size-4" /> Retour
            </Button>
            {isLast ? (
              <Button onClick={close} className="gap-2 bg-gradient-to-r from-primary to-fuchsia-500 text-primary-foreground hover:opacity-90">
                Commencer <Rocket className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)} className="gap-2">
                Suivant <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}