import { createClient } from "@/lib/supabase/client";
import type { Language } from "@/lib/reels";

/** Save the seller's own preferences (RLS + column grants only allow language and region). */
export async function saveProfile(fields: { language?: Language; region?: string }): Promise<void> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const { error } = await supabase.from("profiles").update(fields).eq("id", data.session?.user.id ?? "");
  if (error) throw new Error("Couldn't save that. Please check your internet and try again.");
}
