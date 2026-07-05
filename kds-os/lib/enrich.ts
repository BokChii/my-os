import { supabase } from "@/lib/supabase/client";
import type { Item } from "@/types/db";

export async function enrichLink(
  id: string,
  url: string,
  existing: Item["metadata"] = {},
) {
  try {
    const res = await fetch(`/api/link-meta?url=${encodeURIComponent(url)}`);
    const meta = await res.json();
    await supabase
      .from("items")
      .update({
        metadata: {
          ...existing,
          ...meta,
          read_state: existing.read_state ?? "unread",
        },
      })
      .eq("id", id);
    return meta;
  } catch {
    return null;
  }
}