import Link from "next/link";
import { type Me, reelsLeftText } from "@/lib/reels";

/** "2 of 3 free Reels left this month" plus a pricing link on the free plan. */
export default function QuotaLine({ me }: { me: Me }) {
  return (
    <p className="mt-1 text-sm text-neutral-600">
      {reelsLeftText(me)}
      {me.profile.plan === "free" && (
        <>
          {" · "}
          <Link href="/pricing" className="font-semibold text-neutral-900 underline">Get unlimited</Link>
        </>
      )}
    </p>
  );
}
