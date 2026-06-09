import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send, Globe, Users as UsersIcon, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Fil d'actualité — Scholar" }] }),
  component: FeedPage,
});

type Scope = "school" | "class";

function FeedPage() {
  const { user } = useAuth();
  const { data: profile } = useMyProfile(user?.id);
  const [scope, setScope] = useState<Scope>("school");

  return (
    <div>
      <PageHeader title="Fil d'actualité" description="Partage ce qui se passe dans ta classe et ton établissement." />

      <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
        <TabsList className="glass mb-4">
          <TabsTrigger value="school" className="gap-2"><Globe className="size-4" />Établissement</TabsTrigger>
          <TabsTrigger value="class" className="gap-2" disabled={!profile?.class_id}>
            <UsersIcon className="size-4" />Ma classe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="school"><FeedBody scope="school" classId={null} /></TabsContent>
        <TabsContent value="class"><FeedBody scope="class" classId={profile?.class_id ?? null} /></TabsContent>
      </Tabs>
    </div>
  );
}

function FeedBody({ scope, classId }: { scope: Scope; classId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["posts", scope, classId],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("*, profiles!posts_author_profile_fkey(full_name), likes(user_id), comments(id)")
        .order("created_at", { ascending: false })
        .limit(50);
      q = scope === "school" ? q.eq("scope", "school") : q.eq("scope", "class").eq("class_id", classId!);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const post = useMutation({
    mutationFn: async () => {
      if (!user || !content.trim()) return;
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: content.trim(),
        scope,
        class_id: scope === "class" ? classId : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const toggleLike = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (!user) return;
      if (liked) {
        await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          post.mutate();
        }}
        className="glass rounded-2xl p-4"
      >
        <Textarea
          placeholder={scope === "school" ? "Une annonce pour l'établissement…" : "Une actualité pour ta classe…"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          maxLength={1000}
          className="glass-input resize-none"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{content.length}/1000</span>
          <Button type="submit" disabled={!content.trim() || post.isPending} className="gap-2">
            <Send className="size-4" />Publier
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : posts?.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          Aucune publication pour l'instant.
        </div>
      ) : (
        posts?.map((p) => {
          const liked = p.likes?.some((l: { user_id: string }) => l.user_id === user?.id);
          return (
            <article key={p.id} className="glass rounded-2xl p-5">
              <header className="mb-3 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent/30 text-sm font-semibold">
                  {(p.profiles?.full_name || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.profiles?.full_name || "Utilisateur"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: fr })}
                  </p>
                </div>
              </header>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
              <footer className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                <button
                  onClick={() => toggleLike.mutate({ postId: p.id, liked })}
                  className="flex items-center gap-1.5 transition-colors hover:text-primary"
                >
                  <Heart className={`size-4 ${liked ? "fill-primary text-primary" : ""}`} />
                  {p.likes?.length ?? 0}
                </button>
                <span className="flex items-center gap-1.5">
                  <MessageCircle className="size-4" />
                  {p.comments?.length ?? 0}
                </span>
              </footer>
            </article>
          );
        })
      )}
    </div>
  );
}
