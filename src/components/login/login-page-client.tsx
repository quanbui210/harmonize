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
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
  if (isChecking) {
    return (
      <LoadingScreen 
        message="Checking Session"
        subMessage="Verifying your authentication status"
      />
    );
  }
  
  if (isRedirecting) {
    return (
      <LoadingScreen 
        message="Redirecting"
        subMessage="Taking you to your dashboard"
      />
    );
  }

  if (isLoggingIn) {
    return (
      <LoadingScreen 
        message="Redirecting to Google"
        subMessage="You will be redirected to sign in with your Google account"
      />
    );
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
      <div className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Header */}
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <div className="rounded-full bg-primary/5 p-3 border border-primary/10">
                <Scale className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Welcome Back
              </p>
              <h1 className="text-3xl font-serif font-bold tracking-tight">
                Sign in to <span className="text-primary">TulliCheck</span>
              </h1>
            </div>
          </div>

          {/* Login Form */}
          <div className="space-y-4">
            <LoginForm 
              redirectTo={redirectTo} 
              signInAction={signInAction}
              onPendingChange={setIsLoggingIn}
            />

            {/* Legal Text */}
            <p className="text-xs text-center text-muted-foreground leading-relaxed">
              By continuing, you agree to our{" "}
              <Link href="#" className="text-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
