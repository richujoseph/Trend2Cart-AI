import { Suspense } from "react";
import ReelStatus from "./reel-status";

export default function ReelPage() {
  return (
    <Suspense>
      <ReelStatus />
    </Suspense>
  );
}
