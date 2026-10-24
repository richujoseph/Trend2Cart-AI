import { Suspense } from "react";
import SignInForm from "./sign-in-form";
import SignInHero from "./sign-in-hero";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <SignInHero />
      <div className="rounded-[40px] bg-white p-6 ring-1 ring-sage/30 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.08)]">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
