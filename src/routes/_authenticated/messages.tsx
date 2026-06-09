import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Loader2, Users as UsersIcon, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({ meta: [{ title: "Messages — Techn301" }] }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, conversation_members(user_id, profiles(full_name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function convTitle(c: any) {
    if (c.name) return c.name;
    const others = (c.conversation_members ?? []).filter((m: any) => m.user_id !== user?.id);
    return others.map((m: any) => m.profiles?.full_name ?? "?").join(", ") || "Conversation";
  }

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader title="Messages" description="Conversations privées et de groupe." action={<NewConversationDialog onCreated={setSelectedId} />} />

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="glass rounded-2xl p-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
          ) : conversations?.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">Aucune conversation. Créez-en une !</p>
          ) : (
            <div className="flex flex-col gap-1">
              {conversations?.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-secondary ${
                    selectedId === c.id ? "bg-primary/10 text-primary" : ""
                  }`}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/30">
                    {c.is_group ? <UsersIcon className="size-4" /> : <MessageSquare className="size-4" />}
                  </div>
                  <span className="truncate font-medium">{convTitle(c)}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selected ? (
          <ChatPanel conversation={selected} title={convTitle(selected)} />
        ) : (
          <div className="glass flex min-h-[420px] items-center justify-center rounded-2xl text-sm text-muted-foreground">
            Sélectionnez ou créez une conversation pour commencer à discuter.
          </div>
        )}
      </div>
    </div>
  );
}

function ChatPanel({ conversation, title }: { conversation: any; title: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", conversation.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*, profiles(full_name)")
        .eq("conversation_id", conversation.id)
        .order("created_at")
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversation.id}` },
        () => qc.invalidateQueries({ queryKey: ["messages", conversation.id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversation.id, qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const send = useMutation({
    mutationFn: async () => {
      if (!text.trim()) return;
      const { error } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user!.id,
        content: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", conversation.id] });
    },
    onError: () => toast.error("Message non envoyé. Vérifiez votre connexion puis réessayez."),
  });

  return (
    <section className="glass flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col rounded-2xl">
      <header className="border-b border-border/60 px-5 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {conversation.conversation_members?.length ?? 0} participant(s)
        </p>
      </header>

      <ScrollArea className="flex-1 px-5 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : messages?.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Aucun message. Lancez la discussion !</p>
        ) : (
          <div className="space-y-3">
            {messages?.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {!mine && <p className="mb-0.5 text-[11px] font-semibold opacity-70">{m.profiles?.full_name}</p>}
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <p className={`mt-1 text-right text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      <form
        onSubmit={(e) => { e.preventDefault(); send.mutate(); }}
        className="flex items-center gap-2 border-t border-border/60 p-3"
      >
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Écrire un message…"
          maxLength={2000}
          className="glass-input flex-1"
        />
        <Button type="submit" size="icon" disabled={!text.trim() || send.isPending} aria-label="Envoyer">
          <Send className="size-4" />
        </Button>
      </form>
    </section>
  );
}

function NewConversationDialog({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const { data: people } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const candidates = (people ?? [])
    .filter((p) => p.id !== user?.id)
    .filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase()));

  const create = useMutation({
    mutationFn: async () => {
      if (selected.length === 0) throw new Error("Sélectionnez au moins une personne.");
      const isGroup = selected.length > 1;
      if (isGroup && !name.trim()) throw new Error("Donnez un nom à votre groupe.");
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({ created_by: user!.id, is_group: isGroup, name: isGroup ? name.trim() : null })
        .select()
        .single();
      if (error) throw error;
      const members = [user!.id, ...selected].map((uid) => ({ conversation_id: conv.id, user_id: uid }));
      const { error: mErr } = await supabase.from("conversation_members").insert(members);
      if (mErr) throw mErr;
      return conv.id as string;
    },
    onSuccess: (id) => {
      toast.success("Conversation créée !");
      setOpen(false);
      setSelected([]);
      setName("");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      onCreated(id);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Impossible de créer la conversation."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="size-4" />Nouvelle conversation</Button>
      </DialogTrigger>
      <DialogContent className="glass-strong">
        <DialogHeader><DialogTitle>Nouvelle conversation</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          {selected.length > 1 && (
            <div>
              <Label htmlFor="gname">Nom du groupe</Label>
              <Input id="gname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="glass-input" placeholder="Projet techno…" />
            </div>
          )}
          <div>
            <Label htmlFor="psearch">Participants</Label>
            <Input id="psearch" value={search} onChange={(e) => setSearch(e.target.value)} className="glass-input mb-2" placeholder="Rechercher une personne…" />
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-border/60 p-2">
              {candidates.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-secondary">
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={(v) =>
                      setSelected((prev) => (v ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                    }
                  />
                  {p.full_name}
                </label>
              ))}
              {candidates.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Aucun résultat.</p>}
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {selected.length > 1 ? "Créer le groupe" : "Démarrer la conversation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}