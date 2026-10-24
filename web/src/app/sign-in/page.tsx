import { Suspense } from "react";
import SignInForm from "./sign-in-form";
import SignInHero from "./sign-in-hero";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <SignInHero />
      <div className="rounded-[28px] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 ring-1 ring-white/[0.08] backdrop-blur-xl">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
