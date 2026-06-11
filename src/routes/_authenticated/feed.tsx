import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart, MessageCircle, Send, Globe, Users as UsersIcon, Loader2, Repeat2, Plus, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMyProfile, useMyRoles, hasRole } from "@/hooks/use-profile";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/feed")({
  head: () => ({ meta: [{ title: "Fil d'actualité — Techn301" }] }),
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

      <StoriesBar />

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
        .select(
          "*, profiles!posts_author_profile_fkey(full_name), shared_grade:grades(id, value, max_value, label, date, subjects(name, color)), likes(user_id), reposts(user_id), comments(id, content, created_at, author_id, profiles!comments_author_profile_fkey(full_name))",
        )
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
        const { error } = await supabase.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("likes").insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
    onError: () => toast.error("Action impossible pour le moment. Réessayez."),
  });

  const toggleRepost = useMutation({
    mutationFn: async ({ postId, reposted }: { postId: string; reposted: boolean }) => {
      if (!user) return;
      if (reposted) {
        const { error } = await supabase.from("reposts").delete().eq("post_id", postId).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reposts").insert({ post_id: postId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      if (!v.reposted) toast.success("Publication republiée !");
    },
    onError: () => toast.error("Republication impossible pour le moment. Réessayez."),
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
          const reposted = p.reposts?.some((r: { user_id: string }) => r.user_id === user?.id);
          return (
            <PostCard
              key={p.id}
              post={p}
              liked={liked}
              reposted={reposted}
              onLike={() => toggleLike.mutate({ postId: p.id, liked })}
              onRepost={() => toggleRepost.mutate({ postId: p.id, reposted })}
            />
          );
        })
      )}
    </div>
  );
}

function PostCard({
  post: p,
  liked,
  reposted,
  onLike,
  onRepost,
  onDelete,
}: {
  post: any;
  liked: boolean;
  reposted: boolean;
  onLike: () => void;
  onRepost: () => void;
  onDelete?: () => void;
}) {
  const { user } = useAuth();
  const { data: roles } = useMyRoles(user?.id);
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState("");

  const addComment = useMutation({
    mutationFn: async () => {
      if (!user || !comment.trim()) return;
      const { error } = await supabase.from("comments").insert({
        post_id: p.id,
        author_id: user.id,
        content: comment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => toast.error("Commentaire non publié. Réessayez."),
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
    onError: () => toast.error("Suppression impossible : ce n'est pas votre commentaire."),
  });

  const comments = [...(p.comments ?? [])].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const canDeletePost = p.author_id === user?.id || hasRole(roles, "admin");

  return (
    <article className="glass rounded-2xl p-5">
      {(p.reposts?.length ?? 0) > 0 && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Repeat2 className="size-3.5" /> Republié {p.reposts.length} fois
        </p>
      )}
      <header className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-accent/30 text-sm font-semibold">
            {(p.profiles?.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold">{p.profiles?.full_name || "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: fr })}
            </p>
          </div>
        </div>
        {canDeletePost && onDelete && (
          <button onClick={onDelete} aria-label="Supprimer la publication" className="text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </button>
        )}
      </header>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.content}</p>
      {p.shared_grade && (
        <div className="mt-3 rounded-xl border border-border/60 bg-secondary/40 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase text-muted-foreground">Note partagée</p>
              <p className="text-sm font-semibold">
                {p.shared_grade.subjects?.name ?? "Matière"}
                {p.shared_grade.label ? ` — ${p.shared_grade.label}` : ""}
              </p>
            </div>
            <span className="text-lg font-semibold">
              {p.shared_grade.value}<span className="text-xs text-muted-foreground">/{p.shared_grade.max_value}</span>
            </span>
          </div>
        </div>
      )}
      <footer className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
        <button onClick={onLike} className="flex items-center gap-1.5 transition-colors hover:text-primary" aria-label="J'aime">
          <Heart className={`size-4 ${liked ? "fill-primary text-primary" : ""}`} />
          {p.likes?.length ?? 0}
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 transition-colors hover:text-primary"
          aria-label="Commentaires"
        >
          <MessageCircle className="size-4" />
          {comments.length}
        </button>
        <button
          onClick={onRepost}
          className={`flex items-center gap-1.5 transition-colors hover:text-primary ${reposted ? "text-primary" : ""}`}
          aria-label="Republier"
        >
          <Repeat2 className="size-4" />
          {p.reposts?.length ?? 0}
        </button>
      </footer>

      {showComments && (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
          {comments.map((c: any) => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/30 text-xs font-semibold">
                {(c.profiles?.full_name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 rounded-xl bg-secondary/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold">{c.profiles?.full_name}</p>
                  {c.author_id === user?.id && (
                    <button onClick={() => deleteComment.mutate(c.id)} aria-label="Supprimer le commentaire">
                      <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
                <p className="text-sm">{c.content}</p>
              </div>
            </div>
          ))}
          <form
            onSubmit={(e) => { e.preventDefault(); addComment.mutate(); }}
            className="flex items-center gap-2"
          >
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Écrire un commentaire…"
              maxLength={500}
              className="glass-input flex-1"
            />
            <Button type="submit" size="icon" variant="ghost" disabled={!comment.trim() || addComment.isPending} aria-label="Publier le commentaire">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </article>
  );
}

const STORY_COLORS: Record<string, string> = {
  indigo: "oklch(0.58 0.18 264)",
  cyan: "oklch(0.62 0.14 200)",
  rose: "oklch(0.62 0.18 350)",
  amber: "oklch(0.7 0.15 75)",
  emerald: "oklch(0.62 0.15 155)",
};

function StoriesBar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: stories } = useQuery({
    queryKey: ["stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stories")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const deleteStory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setViewing(null);
      toast.success("Story supprimée.");
      qc.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: () => toast.error("Suppression impossible : ce n'est pas votre story."),
  });

  return (
    <div className="mb-4 flex items-center gap-3 overflow-x-auto pb-1">
      <NewStoryDialog />
      {stories?.map((s) => (
        <button key={s.id} onClick={() => setViewing(s)} className="flex shrink-0 flex-col items-center gap-1">
          <span
            className="flex size-14 items-center justify-center rounded-full p-[3px]"
            style={{ background: STORY_COLORS[s.color] ?? STORY_COLORS.indigo }}
          >
            <span className="flex size-full items-center justify-center rounded-full bg-background text-sm font-semibold">
              {(s.profiles?.full_name || "?").charAt(0).toUpperCase()}
            </span>
          </span>
          <span className="max-w-16 truncate text-[10px] text-muted-foreground">
            {(s.profiles?.full_name || "?").split(" ")[0]}
          </span>
        </button>
      ))}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="border-none p-0">
          {viewing && (
            <div
              className="flex min-h-[420px] flex-col justify-between rounded-2xl p-6 text-white"
              style={{ background: STORY_COLORS[viewing.color] ?? STORY_COLORS.indigo }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold drop-shadow">{viewing.profiles?.full_name}</p>
                {viewing.author_id === user?.id && (
                  <Button variant="ghost" size="sm" onClick={() => deleteStory.mutate(viewing.id)} className="text-white hover:bg-white/20">
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <p className="my-10 text-center text-2xl font-semibold leading-snug drop-shadow">{viewing.content}</p>
              <p className="text-center text-xs opacity-80">
                {formatDistanceToNow(new Date(viewing.created_at), { addSuffix: true, locale: fr })} · disparaît après 24h
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewStoryDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [color, setColor] = useState("indigo");

  const create = useMutation({
    mutationFn: async () => {
      if (!content.trim()) throw new Error("Écrivez quelque chose dans votre story.");
      const { error } = await supabase.from("stories").insert({
        author_id: user!.id,
        content: content.trim(),
        color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Story publiée pour 24 heures !");
      setOpen(false);
      setContent("");
      qc.invalidateQueries({ queryKey: ["stories"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Impossible de publier la story."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex shrink-0 flex-col items-center gap-1" aria-label="Créer une story">
          <span className="flex size-14 items-center justify-center rounded-full border-2 border-dashed border-border">
            <Plus className="size-5 text-muted-foreground" />
          </span>
          <span className="text-[10px] text-muted-foreground">Ma story</span>
        </button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouvelle story (24h)</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={200}
            placeholder="Quoi de neuf ?"
            className="glass-input resize-none"
          />
          <div className="flex items-center gap-2">
            {Object.entries(STORY_COLORS).map(([key, val]) => (
              <button
                key={key}
                type="button"
                onClick={() => setColor(key)}
                className={`size-8 rounded-full transition-transform ${color === key ? "scale-110 ring-2 ring-ring ring-offset-2" : ""}`}
                style={{ background: val }}
                aria-label={`Couleur ${key}`}
              />
            ))}
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Publier ma story
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
