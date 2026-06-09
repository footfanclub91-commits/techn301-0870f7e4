import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  userId: string;
  currentPath?: string | null;
  onUploaded: (path: string) => void;
  label?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function BannerUpload({ userId, onUploaded, label = "Changer la bannière" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté. JPG, PNG, WebP ou GIF uniquement.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (max 5 Mo).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const key = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("banners")
        .upload(key, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      onUploaded(`banners/${key}`);
      toast.success("Bannière mise à jour");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="glass"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {label}
      </Button>
    </>
  );
}
