import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { School, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { SignedImage } from "@/components/SignedImage";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — Techn301" }] }),
  component: Page,
});

function Page() {
  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader title="Classes" description="Toutes les classes de l'établissement." />
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : classes?.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">Aucune classe créée. Admin&nbsp;: créez-en depuis l'administration.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes?.map((c) => (
            <article key={c.id} className="glass overflow-hidden rounded-2xl">
              <div className="relative h-32 w-full overflow-hidden">
                <SignedImage path={c.banner_url} alt={`Bannière ${c.name}`} className="h-full w-full object-cover" fallbackClassName="h-full w-full" />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <School className="size-4 text-primary" />
                  <h3 className="text-base font-semibold">{c.name}</h3>
                </div>
                {c.level && <p className="mt-0.5 text-xs text-muted-foreground">{c.level}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
