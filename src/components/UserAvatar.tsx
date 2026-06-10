import { useSignedUrl } from "@/hooks/use-signed-url";
import { cn } from "@/lib/utils";

interface Props {
  path?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const sizeMap = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-lg",
  xl: "size-24 text-3xl",
};

export function UserAvatar({ path, name, size = "md", className }: Props) {
  const { data: url } = useSignedUrl(path ?? null);
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/30 font-semibold text-foreground",
        sizeMap[size],
        className,
      )}
    >
      {url ? (
        <img src={url} alt={name ?? "Avatar"} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </div>
  );
}