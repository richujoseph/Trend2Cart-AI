import { Suspense } from "react";
import Doctor from "./doctor";

export default function DoctorPage() {
  return (
    <Suspense>
      <Doctor />
    </Suspense>
  );
}
