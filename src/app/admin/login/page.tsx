
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access the system administration panel.
          </p>
        </div>

        <AdminLoginForm />

        <div className="text-center">
          <Link 
            href="/login" 
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          >
            Back to regular login
          </Link>
        </div>
      </div>
    </div>
  );
}
