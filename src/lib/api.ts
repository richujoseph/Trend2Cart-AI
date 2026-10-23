import { createClient } from "@/lib/supabase/client";

/** Call the FastAPI backend as the signed-in user. Throws an Error with a seller-friendly message. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in to continue.");

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("We couldn't reach Trend2Cart. Check your internet and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Something went wrong. Please try again.");
  }
  return res.json();
}
