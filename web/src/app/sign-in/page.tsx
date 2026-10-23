import { Suspense } from "react";
import SignInForm from "./sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">Trend2Cart AI</h1>
      <p className="mt-1 text-sm text-neutral-600">Find profitable products and make Reels in your language.</p>
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
