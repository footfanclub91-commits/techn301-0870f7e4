import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/annuaire")({
  head: () => ({ meta: [{ title: "Annuaire — Techn301" }] }),
  component: Page,
});

function Page() {
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["annuaire", term],
    queryFn: async () => {
      let req = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, classes(name)")
        .order("full_name")
        .limit(80);
      if (term.length >= 2) req = req.ilike("full_name", `%${term}%`);
      const { data, error } = await req;
      if (error) throw error;
      const ids = (data ?? []).map((p) => p.id);
      const { data: rolesData } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const rolesByUser = new Map<string, string[]>();
      rolesData?.forEach((r) => {
        if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, []);
        rolesByUser.get(r.user_id)!.push(r.role);
      });
      return (data ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  return (
    <div>
      <PageHeader
        title="Annuaire"
        description="Recherche un élève, un professeur ou un personnel de l'établissement."
      />

      <div className="glass mb-6 flex items-center gap-2 rounded-2xl px-4 py-2">
        <Search className="size-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.map((u) => {
            const role =
              u.roles.includes("admin") ? "Administrateur"
              : u.roles.includes("professeur") ? "Professeur"
              : u.roles.includes("cpe") ? "Vie scolaire"
              : "Élève";
            return (
              <Link
                key={u.id}
                to="/u/$userId"
                params={{ userId: u.id }}
                className="glass flex items-center gap-3 rounded-2xl p-4 transition-colors hover:bg-secondary/50"
              >
                <UserAvatar path={u.avatar_url} name={u.full_name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.full_name ?? "Sans nom"}</p>
                  <p className="truncate text-xs text-muted-foreground">{role}{u.classes?.name ? ` · ${u.classes.name}` : ""}</p>
                </div>
              </Link>
            );
          })}
          {data && data.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Aucun résultat.</p>
          )}
        </div>
      )}
    </div>
  );
}