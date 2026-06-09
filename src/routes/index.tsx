import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, BookOpen, GraduationCap, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Techn301 — Plateforme de vie scolaire de la classe" },
      {
        name: "description",
        content:
          "Techn301 réunit gestion scolaire complète (devoirs, notes, vie scolaire) et fil d'actualité de classe dans une interface épurée.",
      },
      { property: "og:title", content: "Techn301 — Plateforme de vie scolaire de la classe" },
      {
        property: "og:description",
        content: "Devoirs, notes, vie scolaire et fil d'actualité de classe, dans une interface glassmorphism épurée.",
      },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/feed" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold">
            T
          </div>
          <span className="text-lg font-semibold">Techn301</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link to="/auth">
            <Button variant="ghost" size="sm">
              Se connecter
            </Button>
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <section className="grid items-center gap-12 md:grid-cols-2">
          <div className="animate-float-in">
            <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5" />
              Classe de 3e — Techn301
            </div>
            <h1 className="text-balance text-4xl font-semibold leading-tight md:text-5xl">
              Techn301 : la plateforme qui réunit cours, notes et vie de classe.
            </h1>
            <p className="mt-4 text-pretty text-base text-muted-foreground md:text-lg">
              Devoirs, moyennes, incidents disciplinaires et fil d'actualité interne — pensé pour les élèves, professeurs et
              équipes de vie scolaire.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Commencer <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="glass animate-float-in rounded-3xl p-2">
            <div className="grid grid-cols-2 gap-3 p-2">
              {[
                { icon: BookOpen, label: "Devoirs", value: "Centralisés" },
                { icon: GraduationCap, label: "Notes /20", value: "Auto-calculées" },
                { icon: Users, label: "Réseau", value: "Interne" },
                { icon: Sparkles, label: "Bannières", value: "GIF animés" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="glass rounded-2xl p-4">
                  <Icon className="mb-3 size-5 text-primary" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
