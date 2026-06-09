import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Generates a signed URL for a private storage object.
 * `path` shape: "{bucket}/{rest/of/key.ext}"
 */
export function useSignedUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", path],
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!path) return null;
      const [bucket, ...rest] = path.split("/");
      const key = rest.join("/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(key, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
