import { Suspense } from "react";
import NewReel from "./new-reel";

export default function NewReelPage() {
  return (
    <Suspense>
      <NewReel />
    </Suspense>
  );
}
