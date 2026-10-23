import { createClient } from "@/lib/supabase/client";

/** Error with a seller-friendly message and the HTTP status (0 = network problem). */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/** Call the FastAPI backend as the signed-in user. Throws ApiError with a seller-friendly message. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Please sign in to continue.", 401);

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError("We couldn't reach Trend2Cart. Check your internet and try again.", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      typeof body?.detail === "string" ? body.detail : "Something went wrong. Please try again.",
      res.status,
    );
  }
  return res.json();
}
