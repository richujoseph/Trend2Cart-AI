import { Suspense } from "react";
import SignInForm from "./sign-in-form";
import SignInHero from "./sign-in-hero";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <SignInHero />
      <div className="rounded-3xl bg-white p-5 shadow-xl shadow-brand-900/10 ring-1 ring-brand-900/5">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
