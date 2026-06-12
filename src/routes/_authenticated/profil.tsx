import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useMyRoles } from "@/hooks/use-profile";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { PageHeader } from "@/components/AppShell";
import { SignedImage } from "@/components/SignedImage";
import { BannerUpload } from "@/components/BannerUpload";
import { AvatarUpload } from "@/components/AvatarUpload";
import { UserAvatar } from "@/components/UserAvatar";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({ meta: [{ title: "Mon profil — Techn301" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  const { data: roles } = useMyRoles(user?.id);
  const qc = useQueryClient();

  const [fullName, setFullName] = useState<string | null>(null);
  const [bio, setBio] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const { data: bannerUrl } = useSignedUrl(profile?.banner_url);

  const update = useMutation({
    mutationFn: async (patch: Partial<{ full_name: string; bio: string; banner_url: string; avatar_url: string; allow_animations: boolean }>) => {
      if (!user) return;
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profil mis à jour");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const name = fullName ?? profile?.full_name ?? "";
  const bioVal = bio ?? profile?.bio ?? "";

  if (!user) return null;

  return (
    <div>
      <PageHeader title="Mon profil" description="Personnalise ta page : bannière (JPG, PNG, WebP, GIF animé) et présentation." />

      <article className="glass rounded-3xl">
        <div className="relative h-48 w-full overflow-hidden rounded-t-3xl md:h-64">
          <button
            type="button"
            onClick={() => profile?.banner_url && setLightbox(true)}
            className="block h-full w-full"
            aria-label="Voir la bannière en grand"
          >
            <SignedImage path={profile?.banner_url} alt="Bannière" className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
          </button>
          <div className="absolute right-4 top-4">
            <BannerUpload userId={user.id} onUploaded={(path) => update.mutate({ banner_url: path })} />
          </div>
        </div>
        <div className="relative -mt-20 flex flex-col items-start gap-4 p-6 md:flex-row md:items-end">
          <div className="relative z-10 flex flex-col items-center gap-2">
            <UserAvatar path={profile?.avatar_url} name={profile?.full_name ?? user.email} size="xl" className="ring-4 ring-background" />
            <AvatarUpload userId={user.id} onUploaded={(path) => update.mutate({ avatar_url: path })} />
          </div>
          <div className="flex-1 md:pb-1">
            <h2 className="text-2xl font-semibold">{profile?.full_name || user.email}</h2>
            <p className="text-sm text-muted-foreground">
              {roles?.includes("admin") ? "Administrateur" :
               roles?.includes("professeur") ? "Professeur" :
               roles?.includes("cpe") ? "Vie scolaire" : "Élève"}
            </p>
          </div>
        </div>
      </article>

      <ImageLightbox url={lightbox ? bannerUrl ?? null : null} alt="Bannière" onClose={() => setLightbox(false)} />

      <section className="mt-6 glass rounded-2xl p-6">
        <h3 className="mb-4 text-lg font-semibold">Informations</h3>
        <form
          onSubmit={(e) => { e.preventDefault(); update.mutate({ full_name: name, bio: bioVal }); }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="full-name">Nom complet</Label>
            <Input id="full-name" value={name} onChange={(e) => setFullName(e.target.value)} className="glass-input" />
          </div>
          <div>
            <Label htmlFor="bio">Présentation</Label>
            <Textarea id="bio" value={bioVal} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className="glass-input" />
          </div>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}Enregistrer
          </Button>
        </form>
      </section>

      <section className="mt-6 glass flex items-center justify-between rounded-2xl p-6">
        <div>
          <h3 className="font-semibold">Animations & GIFs</h3>
          <p className="text-sm text-muted-foreground">Pause automatique en mode économie de données.</p>
        </div>
        <Switch
          checked={profile?.allow_animations ?? true}
          onCheckedChange={(v) => update.mutate({ allow_animations: v })}
        />
      </section>
    </div>
  );
}
