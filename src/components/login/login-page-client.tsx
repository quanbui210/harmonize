"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingScreen } from "@/components/ui/loading-screen";
import Link from "next/link";
import { Scale } from "lucide-react";
import { LoginForm } from "./login-form";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type LoginPageClientProps = {
  redirectTo: string;
  signInAction: (formData: FormData) => Promise<void>;
};

export function LoginPageClient({ redirectTo, signInAction }: LoginPageClientProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Check if there's a session using Supabase browser client
    const checkSession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Session exists, redirect immediately and keep loading screen
          setIsRedirecting(true);
          router.replace(redirectTo || "/dashboard");
          // Keep loading screen visible during redirect - don't set isChecking to false
          return;
        }
        
        // No session, show login form
        setIsChecking(false);
      } catch (error) {
        // Error checking session, show login form anyway
        console.error("Session check failed:", error);
        setIsChecking(false);
      }
    };

    checkSession();
  }, [redirectTo, router]);

  // Show loading while checking for session or redirecting
  if (isChecking || isRedirecting) {
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
                Harmonize<span className="text-primary">AI</span>
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
                Sign in to <span className="text-primary">HarmonizeAI</span>
              </h1>
              <p className="text-base text-muted-foreground italic leading-relaxed">
                Use your verified organization email to continue.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <div className="space-y-6">
            <LoginForm redirectTo={redirectTo} signInAction={signInAction} />

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
