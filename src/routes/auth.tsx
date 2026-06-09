import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Techn301" },
      { name: "description", content: "Connectez-vous à votre espace Techn301 pour accéder à vos cours, devoirs et notes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@")) {
      setError("Saisissez votre identifiant complet, par exemple : prenom.nom@techn301.fr");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setLoading(false);
    if (err) {
      const message = translateAuthError(err.message);
      setError(message);
      toast.error(message);
      return;
    }
    toast.success("Connexion réussie !");
    router.navigate({ to: "/feed" });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="glass w-full max-w-md rounded-3xl p-8 animate-float-in">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold">
              T
            </div>
            <span className="text-lg font-semibold">Techn301</span>
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-xl font-semibold">Connexion</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Utilisez l'identifiant et le mot de passe provisoire transmis via l'ENT.
        </p>

        <form onSubmit={signIn} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email-in">Identifiant</Label>
            <Input
              id="email-in"
              type="email"
              required
              autoComplete="username"
              placeholder="prenom.nom@techn301.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="glass-input"
            />
          </div>
          <div>
            <Label htmlFor="pw-in">Mot de passe</Label>
            <Input
              id="pw-in"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Les comptes sont créés par l'établissement. À votre première connexion, vous devrez choisir un nouveau mot
          de passe. En cas d'oubli, contactez l'administration.
        </p>
      </div>
    </div>
  );
}
