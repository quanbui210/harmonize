"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scale } from "lucide-react";

type LoginClientProps = {
  redirectTo: string;
};

export function LoginClient({ redirectTo }: LoginClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check", { 
          method: "GET",
          credentials: "include"
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated) {
            router.push(redirectTo);
            return;
          }
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [redirectTo, router]);

  async function signInWithGoogle() {
    setIsLoading(true);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/login";
    
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "redirectTo";
    input.value = redirectTo;
    form.appendChild(input);
    
    document.body.appendChild(form);
    form.submit();
  }

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="group transition-all duration-300 hover:opacity-80">
              <span className="text-2xl font-serif font-bold tracking-tight">
                Tulli<span className="text-primary">Check</span>
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link 
                href="/" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link 
                href="/login?redirectTo=/dashboard" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Login
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Scale className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Welcome Back
              </p>
              <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight">
                Sign in to <span className="text-primary">TulliCheck</span>
              </h1>
              <p className="text-base text-muted-foreground italic leading-relaxed">
                Use your verified organization email to continue.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <div className="space-y-6">
            <form action="/api/auth/google" method="POST" className="space-y-4">
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button
                type="submit"
                className="w-full h-12 text-base font-medium"
                size="lg"
                onClick={(e) => {
                  e.preventDefault();
                  signInWithGoogle();
                }}
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

            {/* Trust Indicators */}
            <div className="space-y-4 rounded-lg border bg-card p-6">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span>Get your imports past customs successfully</span>
              </div>
              <div className="border-t pt-4 text-center">
                <p className="text-xs text-muted-foreground mb-3">
                  By continuing, you agree to our{" "}
                  <Link href="#" className="text-primary underline hover:text-primary/80">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-primary underline hover:text-primary/80">
                    Privacy Policy
                  </Link>
                </p>
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Need help?
                  </Link>
                  <span>•</span>
                  <Link href="#" className="hover:text-foreground transition-colors">
                    Contact Support
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
