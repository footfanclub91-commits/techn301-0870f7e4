import { useSignedUrl } from "@/hooks/use-signed-url";

interface Props {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  loading?: "lazy" | "eager";
}

export function SignedImage({ path, alt, className, fallbackClassName, loading = "lazy" }: Props) {
  const { data } = useSignedUrl(path);
  if (!path || !data) {
    return (
      <div
        className={fallbackClassName ?? className}
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(135deg, oklch(0.85 0.13 264 / 0.5), oklch(0.88 0.12 200 / 0.5), oklch(0.9 0.1 320 / 0.5))",
        }}
      />
    );
  }
  return <img src={data} alt={alt} className={className} loading={loading} decoding="async" />;
}
