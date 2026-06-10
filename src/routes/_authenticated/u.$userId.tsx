import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/hooks/use-signed-url";
import { UserAvatar } from "@/components/UserAvatar";
import { SignedImage } from "@/components/SignedImage";
import { ImageLightbox } from "@/components/ImageLightbox";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/u/$userId")({
  head: () => ({ meta: [{ title: "Profil — Techn301" }] }),
  component: Page,
});

function Page() {
  const { userId } = Route.useParams();
  const [lightbox, setLightbox] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, banner_url, bio, classes(name, level)")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      const { data: rolesData } = await supabase
        .from("user_roles").select("role").eq("user_id", userId);
      return { ...profile, roles: (rolesData ?? []).map((r) => r.role) };
    },
  });

  const { data: bannerUrl } = useSignedUrl(data?.banner_url);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin" /></div>;
  if (!data?.id) return <p className="py-12 text-center text-muted-foreground">Profil introuvable.</p>;

  const role =
    data.roles?.includes("admin") ? "Administrateur"
    : data.roles?.includes("professeur") ? "Professeur"
    : data.roles?.includes("cpe") ? "Vie scolaire"
    : "Élève";

  return (
    <div>
      <Link to="/annuaire" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Retour à l'annuaire
      </Link>

      <article className="glass overflow-hidden rounded-3xl">
        <button
          type="button"
          onClick={() => data.banner_url && setLightbox(true)}
          className="relative block h-48 w-full overflow-hidden md:h-64"
          aria-label="Voir la bannière en grand"
        >
          <SignedImage path={data.banner_url} alt="Bannière" className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
        </button>
        <div className="-mt-12 flex flex-col items-start gap-4 p-6 md:flex-row md:items-end">
          <UserAvatar path={data.avatar_url} name={data.full_name} size="xl" className="ring-4 ring-background" />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{data.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              {role}{data.classes?.name ? ` · ${data.classes.name}` : ""}
            </p>
          </div>
          <Link to="/messages">
            <Button variant="secondary" className="gap-2"><MessageSquare className="size-4" />Envoyer un message</Button>
          </Link>
        </div>
        {data.bio && (
          <div className="border-t border-border/60 px-6 py-4">
            <p className="text-sm whitespace-pre-wrap">{data.bio}</p>
          </div>
        )}
      </article>

      <ImageLightbox url={lightbox ? bannerUrl ?? null : null} alt="Bannière" onClose={() => setLightbox(false)} />
    </div>
  );
}