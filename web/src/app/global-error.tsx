"use client";

import { messagesNow } from "@/lib/i18n";

// Last resort when the root layout itself fails: plain HTML, no providers or fonts.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = messagesNow();
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f4fb", margin: 0 }}>
        <div role="alert" style={{ maxWidth: 420, margin: "20vh auto 0", padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, color: "#4c1d95" }}>{t.api.crashTitle}</h1>
          <p style={{ color: "#525252" }}>{t.api.crashBody}</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, height: 48, width: "100%", border: 0, borderRadius: 12, background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 16 }}
          >
            {t.common.tryAgain}
          </button>
        </div>
      </body>
    </html>
  );
}
