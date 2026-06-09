import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Scholar" },
      { name: "description", content: "Connectez-vous à votre espace Scholar pour accéder à vos cours et notes." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    router.navigate({ to: "/feed" });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/feed`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Compte créé ! Vous pouvez vous connecter.");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="glass w-full max-w-md rounded-3xl p-8 animate-float-in">
        <Link to="/" className="mb-6 flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-semibold">
            S
          </div>
          <span className="text-lg font-semibold">Scholar</span>
        </Link>

        <Tabs defaultValue="signin">
          <TabsList className="glass grid w-full grid-cols-2">
            <TabsTrigger value="signin">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
            <form onSubmit={signIn} className="space-y-4">
              <div>
                <Label htmlFor="email-in">Email</Label>
                <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" />
              </div>
              <div>
                <Label htmlFor="pw-in">Mot de passe</Label>
                <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Se connecter
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-6">
            <form onSubmit={signUp} className="space-y-4">
              <div>
                <Label htmlFor="name-up">Nom complet</Label>
                <Input id="name-up" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="glass-input" />
              </div>
              <div>
                <Label htmlFor="email-up">Email</Label>
                <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="glass-input" />
              </div>
              <div>
                <Label htmlFor="pw-up">Mot de passe</Label>
                <Input id="pw-up" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="glass-input" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />} Créer mon compte
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Le premier compte créé devient administrateur de l'établissement.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
