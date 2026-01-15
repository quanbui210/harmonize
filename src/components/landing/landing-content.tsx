"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { ResultPreview } from "@/components/landing/result-preview";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { 
  FileText, 
  Shield, 
  Search, 
  Database, 
  CheckCircle2, 
  BookOpen, 
  Scale,
  Globe,
  Lock,
  TrendingUp,
  FileCheck,
  AlertCircle,
  Waypoints
} from "lucide-react";

type UserData = {
  id: string;
  email: string | null;
  name: string;
  avatar: string | null;
} | null;

type LandingContentProps = {
  user?: UserData;
};

export function LandingContent({ user }: LandingContentProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const router = useRouter();

  const handleLoginClick = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsNavigating(true);
    router.push("/login?redirectTo=/dashboard");
  };

  const handleGoToApp = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    setIsNavigating(true);
    router.push("/dashboard");
  };

  if (isNavigating) {
    return <LoadingScreen />;
  }

  const userInitials = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || 
    user?.email?.slice(0, 2).toUpperCase() || 
    "U";

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
              <a 
                href="#features" 
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("features");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Platform
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a 
                href="#sources" 
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("sources");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Data Sources
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a 
                href="#reliability" 
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("reliability");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Reliability
                <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all duration-300 group-hover:w-full"></span>
              </a>
              {!user && (
                <a 
                  href="/login?redirectTo=/dashboard" 
                  onClick={handleLoginClick}
                  className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                >
                  Login
                  <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-foreground transition-all duration-300 group-hover:w-full"></span>
                </a>
              )}
            </div>
            {user ? (
              <>
                <button
                  onClick={handleGoToApp}
                  className="hidden md:flex items-center gap-3 px-4 py-2 rounded-lg border border-border/50 bg-background hover:bg-muted/30 hover:border-primary/30 transition-all duration-300 group"
                >
                  {user.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt={user.name}
                      className="h-8 w-8 rounded-full ring-1 ring-border/30 group-hover:ring-primary/40 transition-all duration-300"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 text-xs font-semibold text-primary ring-1 ring-border/30 group-hover:ring-primary/40 transition-all duration-300">
                      {userInitials}
                    </div>
                  )}
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium leading-tight group-hover:text-primary transition-colors duration-300">{user.name}</span>
                    <span className="text-xs text-muted-foreground italic leading-tight">Dashboard</span>
                  </div>
                  <svg 
                    className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <Button 
                  onClick={handleGoToApp}
                  size="sm"
                  className="md:hidden transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-foreground/10"
                >
                  Go to App
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleLoginClick}
                className="transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-foreground/10"
              >
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-6 py-20 md:py-32">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          <ScrollAnimation>
            <div>
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                B2B HTS VERIFICATION
              </p>
              <h1 className="text-5xl md:text-6xl font-serif font-bold tracking-tight mb-4 leading-tight">
                Import with <span className="text-primary">Total Legal Certainty</span>
              </h1>
              <p className="text-base text-muted-foreground italic mb-8 leading-relaxed max-w-2xl">
                HarmonizeAI helps you check whether your product can be imported into the EU and what is required to do it legally. We analyze your product against official EU regulations and customs guidance so you can avoid delays, fines, and rejected shipments.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={handleLoginClick}
                  className="transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-foreground/10"
                >
                  Start Risk Scan
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="transition-all duration-300 ease-out hover:scale-105 hover:bg-foreground hover:text-background hover:border-foreground hover:shadow-lg hover:shadow-foreground/10"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById("sources");
                    element?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Learn More
                </Button>
              </div>
              {/* <p className="text-xs text-muted-foreground mt-12 uppercase tracking-wider italic">
                Trusted by 200+ Global Logistics Partners
              </p> */}
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation delay={200}>
            <div className="flex justify-center lg:justify-start">
              <ResultPreview />
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto max-w-7xl px-6 py-20">
        <ScrollAnimation>
          <div className="mb-16">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              PLATFORM
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
              Everything You Need for Compliance
            </h2>
            <p className="text-base text-muted-foreground italic max-w-2xl">
              A comprehensive suite of tools designed to eliminate classification errors and provide 
              defensible audit protection for your import operations.
            </p>
          </div>
        </ScrollAnimation>

        <div className="space-y-12">
          <div className="stagger-fade-in group border-b border-border/30 pb-8 transition-all duration-500 ease-out hover:border-border/60 hover:pb-10 cursor-default" style={{ animationDelay: '0ms' }}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3">
                <Search className="h-6 w-6 text-primary transition-all duration-500 group-hover:text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                  Automated HTS Classification
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Upload product images and descriptions to receive instant, AI-powered HTS code classifications. 
                  Our system analyzes product characteristics against the Harmonized System Tariff and provides 
                  detailed legal reasoning for every classification decision.
                </p>
              </div>
            </div>
          </div>

          <div className="stagger-fade-in group border-b border-border/30 pb-8 transition-all duration-500 ease-out hover:border-border/60 hover:pb-10 cursor-default" style={{ animationDelay: '150ms' }}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3">
                <Shield className="h-6 w-6 text-primary transition-all duration-500 group-hover:text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                  Risk Monitoring & Alerts
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Continuous monitoring of your classifications against regulatory changes, binding rulings, 
                  and enforcement actions. Receive proactive alerts when your products may be at risk of 
                  customs challenges.
                </p>
              </div>
            </div>
          </div>

          <div className="stagger-fade-in group border-b border-border/30 pb-8 transition-all duration-500 ease-out hover:border-border/60 hover:pb-10 cursor-default" style={{ animationDelay: '300ms' }}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3">
                <FileCheck className="h-6 w-6 text-primary transition-all duration-500 group-hover:text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                  Audit Defense Dossiers
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Generate comprehensive defense dossiers that document your classification decisions with 
                  legal precedents, binding rulings, and detailed reasoning. Every dossier is designed to 
                  withstand customs authority scrutiny.
                </p>
              </div>
            </div>
          </div>

          <div className="stagger-fade-in group border-b border-border/30 pb-8 transition-all duration-500 ease-out hover:border-border/60 hover:pb-10 cursor-default" style={{ animationDelay: '450ms' }}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3">
                <Scale className="h-6 w-6 text-primary transition-all duration-500 group-hover:text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                  Product Labeling
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Generate compliant bilingual (Finnish/Swedish) product labels with nutrition tables, 
                  ingredient lists, allergen warnings, and all mandatory EU requirements. Labels can be 
                  exported as PDF or SVG for printing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data Sources Section */}
      <section id="sources" className="container mx-auto max-w-7xl px-6 py-20">
        <ScrollAnimation>
          <div className="mb-16">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              DATA SOURCES
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
              Built on Authoritative Sources
            </h2>
            <p className="text-base text-muted-foreground italic max-w-2xl">
              Our classifications are based exclusively on official regulatory sources and binding legal 
              precedents, ensuring maximum reliability and defensibility.
            </p>
          </div>
        </ScrollAnimation>

        <div className="space-y-12">
          <ScrollAnimation delay={100}>
            <div className="group border-l-4 border-primary/20 pl-6 transition-all duration-500 ease-out hover:border-primary/60 hover:pl-8 hover:bg-muted/30 -ml-2 py-2 rounded-r-md cursor-default">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                EU Combined Nomenclature
              </h3>
              <p className="text-sm text-muted-foreground italic transition-colors duration-500 group-hover:text-foreground/80">
                Official tariff classification system maintained by the European Commission
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="group border-l-4 border-primary/20 pl-6 transition-all duration-500 ease-out hover:border-primary/60 hover:pl-8 hover:bg-muted/30 -ml-2 py-2 rounded-r-md cursor-default">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                Binding Tariff Information (BTI) Rulings
              </h3>
              <p className="text-sm text-muted-foreground italic transition-colors duration-500 group-hover:text-foreground/80">
                Legally binding classification decisions issued by EU customs authorities
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300}>
            <div className="group border-l-4 border-primary/20 pl-6 transition-all duration-500 ease-out hover:border-primary/60 hover:pl-8 hover:bg-muted/30 -ml-2 py-2 rounded-r-md cursor-default">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                Court Decisions & Legal Precedents
              </h3>
              <p className="text-sm text-muted-foreground italic transition-colors duration-500 group-hover:text-foreground/80">
                Historical classification cases and judicial interpretations from EU courts
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={400}>
            <div className="group border-l-4 border-primary/20 pl-6 transition-all duration-500 ease-out hover:border-primary/60 hover:pl-8 hover:bg-muted/30 -ml-2 py-2 rounded-r-md cursor-default">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                Finnish Food Authority (Ruokavirasto)
              </h3>
              <p className="text-sm text-muted-foreground italic transition-colors duration-500 group-hover:text-foreground/80">
                <a 
                  href="https://www.ruokavirasto.fi/en/foodstuffs/food-sector/instructions-and-legislation/#labelling" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline transition-all duration-300"
                >
                  Official food labeling regulations and requirements
                </a>
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Reliability Section */}
      <section id="reliability" className="container mx-auto max-w-7xl px-6 py-20">
        <ScrollAnimation>
          <div className="mb-16">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
              RELIABILITY
            </p>
            <h2 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4">
              Continuous Validation
            </h2>
            <p className="text-base text-muted-foreground italic max-w-2xl">
              Our system continuously validates classifications against new rulings, regulatory updates, 
              and enforcement actions to ensure ongoing compliance.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ScrollAnimation delay={100}>
            <div className="group border border-border/30 rounded-lg p-6 bg-background transition-all duration-500 ease-out hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-500">
                  <Shield className="h-6 w-6 text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:text-primary">
                    Real-Time Updates
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Automatic monitoring of regulatory changes and new binding rulings that may affect 
                    your existing classifications.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="group border border-border/30 rounded-lg p-6 bg-background transition-all duration-500 ease-out hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 cursor-default">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-500">
                  <CheckCircle2 className="h-6 w-6 text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:text-primary">
                    Confidence Scoring
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Every classification includes a confidence score based on the strength of supporting 
                    legal precedents and regulatory alignment.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300}>
            <div className="group border border-border/30 rounded-lg p-6 bg-background transition-all duration-500 ease-out hover:border-primary/60 hover:shadow-lg hover:shadow-primary/5 cursor-default md:col-span-2 lg:col-span-1">
              <div className="flex flex-col items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors duration-500">
                  <Database className="h-6 w-6 text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-6" />
                </div>
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:text-primary">
                    Audit Trail
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Complete documentation of every classification decision, including source materials, 
                    reasoning, and timestamp for full audit compliance.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-20">
        <div className="container mx-auto max-w-4xl px-6 text-center">
          <ScrollAnimation>
          <h2 className="text-4xl font-serif font-semibold tracking-tight mb-3">
            Ready to secure your global imports?
          </h2>
          <p className="text-base text-muted-foreground italic mb-8">
            Join 1,000+ compliance officers who trust HarmonizeAI for their audit protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleLoginClick}
              className="transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-foreground/10"
            >
              Start Your Free Risk Scan
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={handleLoginClick}
              className="transition-all duration-300 ease-out hover:scale-105 hover:bg-foreground hover:text-background hover:border-foreground hover:shadow-lg hover:shadow-foreground/10"
            >
              Talk to an Expert
            </Button>
          </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="group mb-4 inline-block">
                <span className="text-lg font-serif font-bold tracking-tight">
                  Harmonize<span className="text-primary">AI</span>
                </span>
              </Link>
              <p className="text-sm text-muted-foreground italic">
                Legal certainty for the modern importer. Automated, defensible, and precise.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground transition-colors italic">HTS Classification</Link></li>
                <li><Link href="#sources" className="hover:text-foreground transition-colors italic">Risk Monitoring</Link></li>
                <li><Link href="#reliability" className="hover:text-foreground transition-colors italic">Audit Defense</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#sources" className="hover:text-foreground transition-colors italic">Data Sources</Link></li>
                <li><Link href="#reliability" className="hover:text-foreground transition-colors italic">Reliability</Link></li>
                <li><Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors italic">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors italic">About Us</Link></li>
                <li><Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors italic">Legal</Link></li>
                <li><Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors italic">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>© 2024 HarmonizeAI Technologies Inc. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <Link href="/login?redirectTo=/dashboard" className="hover:text-foreground transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

