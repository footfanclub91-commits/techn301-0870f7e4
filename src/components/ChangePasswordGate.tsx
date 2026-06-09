import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Écran bloquant affiché à la première connexion : l'utilisateur doit
 * remplacer son mot de passe provisoire avant d'accéder à Techn301.
 */
export function ChangePasswordGate() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) {
      setError("Le mot de passe doit contenir au moins une lettre et un chiffre.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (err) {
      setError(translateAuthError(err.message));
      return;
    }
    toast.success("Mot de passe modifié ! Bienvenue sur Techn301.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="glass w-full max-w-md rounded-3xl p-8 animate-float-in">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Nouveau mot de passe requis</h1>
            <p className="text-xs text-muted-foreground">
              Votre mot de passe provisoire doit être remplacé avant de continuer.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="new-pw">Nouveau mot de passe</Label>
            <Input
              id="new-pw"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="glass-input"
              placeholder="8 caractères min., lettres et chiffres"
            />
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirmer le mot de passe</Label>
            <Input
              id="confirm-pw"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="glass-input"
            />
          </div>
          {error && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Valider mon nouveau mot de passe
          </Button>
        </form>
      </div>
    </div>
  );
}