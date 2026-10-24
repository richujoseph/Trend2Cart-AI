import { messagesNow } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

/** Error with a seller-friendly message and the HTTP status (0 = network problem). */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const DEFAULT_TIMEOUT_MS = 25_000;

/** Call the FastAPI backend as the signed-in user. Throws ApiError with a seller-friendly message.
 *  Gives up after timeoutMs (status 0) so a stuck request never leaves a spinner forever. */
export async function apiFetch<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(messagesNow().api.signIn, 401);

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
      ...rest,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        ...(rest.body ? { "Content-Type": "application/json" } : {}),
        ...rest.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (err) {
    const timedOut = (err as Error).name === "TimeoutError";
    throw new ApiError(timedOut ? messagesNow().api.timeout : messagesNow().api.network, 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      typeof body?.detail === "string" ? body.detail : messagesNow().api.generic,
      res.status,
    );
  }
  return res.status === 204 ? (undefined as T) : res.json();
}
