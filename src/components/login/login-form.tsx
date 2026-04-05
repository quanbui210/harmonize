"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  redirectTo: string;
  signInAction: (formData: FormData) => Promise<void>;
  onPendingChange?: (isPending: boolean) => void;
  onPasswordSignIn: (input: { identifier: string; password: string }) => Promise<void>;
};

export function LoginForm({
  redirectTo,
  signInAction,
  onPendingChange,
  onPasswordSignIn,
}: LoginFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isPasswordPending, setIsPasswordPending] = useState(false);
  const [mode, setMode] = useState<"admin" | "employee">("admin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onPendingChange?.(true);
    startTransition(async () => {
      const formData = new FormData(e.currentTarget);
      await signInAction(formData);
    });
  }

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPasswordError(null);
    setIsPasswordPending(true);
    try {
      await onPasswordSignIn({ identifier, password });
    } catch (error: any) {
      setPasswordError(error?.message || "Invalid username or password.");
    } finally {
      setIsPasswordPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={mode === "admin" ? "default" : "outline"}
          onClick={() => {
            setMode("admin");
            setPasswordError(null);
          }}
        >
          Admin Login
        </Button>
        <Button
          type="button"
          variant={mode === "employee" ? "default" : "outline"}
          onClick={() => {
            setMode("employee");
            setPasswordError(null);
          }}
        >
          Employee Login
        </Button>
      </div>

      {mode === "employee" ? (
        <form onSubmit={handlePasswordSubmit} className="space-y-3 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Username</Label>
            <Input
              id="identifier"
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Enter your username"
              disabled={isPasswordPending}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
              }}
              placeholder="Enter your password"
              disabled={isPasswordPending}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isPasswordPending}>
            {isPasswordPending ? "Signing in..." : "Sign in as Employee"}
          </Button>
          {passwordError ? <p className="text-sm text-destructive">{passwordError}</p> : null}
        </form>
      ) : (
        <form action={signInAction} className="space-y-4 rounded-lg border p-4" onSubmit={handleSubmit}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <Button
            type="submit"
            className="w-full h-11 text-sm font-medium shadow-sm hover:shadow transition-shadow"
            size="lg"
            disabled={isPending}
            variant="outline"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-2.5 h-4 w-4"
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
      )}
    </div>
  );
}
