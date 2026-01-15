"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";

type LoginFormProps = {
  redirectTo: string;
  signInAction: (formData: FormData) => Promise<void>;
};

export function LoginForm({ redirectTo, signInAction }: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      await signInAction(formData);
    });
  }

  if (isPending) {
    return <LoadingScreen />;
  }

  return (
    <form action={signInAction} className="space-y-4" onSubmit={handleSubmit}>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <Button
        type="submit"
        className="w-full h-12 text-base font-medium"
        size="lg"
        disabled={isPending}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="mr-3 h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d="M12 8.5c1.04 0 1.97.36 2.7 1.06l2-2C15.62 6.17 13.96 5.5 12 5.5A6.5 6.5 0 0 0 5.71 9.39l2.4 1.86A3.9 3.9 0 0 1 12 8.5Z"
            fill="currentColor"
          />
          <path
            d="M17.5 12.05c0-.37-.04-.73-.11-1.05H12v3h3.5a3 3 0 0 1-1.3 1.95l2.03 1.58C17.16 16.33 17.5 14.86 17.5 12.05Z"
            fill="currentColor"
          />
          <path
            d="M8.11 15.75A3.98 3.98 0 0 1 8 12c0-.45.08-.88.2-1.28l-2.4-1.87A6.49 6.49 0 0 0 5.5 12c0 1.06.26 2.06.71 2.94l1.9-1.48Z"
            fill="currentColor"
          />
          <path
            d="M12 18.5c1.96 0 3.61-.64 4.81-1.74l-2.03-1.58c-.56.38-1.28.62-2.12.62a3.9 3.9 0 0 1-3.88-2.91l-2.39 1.86A6.49 6.49 0 0 0 12 18.5Z"
            fill="currentColor"
          />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}
