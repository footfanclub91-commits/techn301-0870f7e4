import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MAX_BYTES = 3 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"]; // pas de GIF animé

interface Props {
  userId: string;
  onUploaded: (path: string) => void;
  label?: string;
}

export function AvatarUpload({ userId, onUploaded, label = "Changer la photo" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handle(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté. JPG, PNG ou WebP uniquement (pas de GIF animé).");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Fichier trop volumineux (max 3 Mo).");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const key = `${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(key, file, { upsert: true, cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      onUploaded(`avatars/${key}`);
      toast.success("Photo de profil mise à jour");
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
        className="gap-2"
      >
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {label}
      </Button>
    </>
  );
}