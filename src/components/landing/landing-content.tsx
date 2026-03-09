"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { ResultPreview } from "@/components/landing/result-preview";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { CookiePolicyDialog } from "@/components/legal/cookie-policy-dialog";
import { PrivacyPolicyDialog } from "@/components/legal/privacy-policy-dialog";
import { TermsOfServiceDialog } from "@/components/legal/terms-of-service-dialog";
import { 
  Shield, 
  Search, 
  Database, 
  CheckCircle2, 
  Scale,
  Lock,
  FileCheck,
  FileText,
  Users,
  Truck,
  ClipboardCheck
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

const heroStats = [
  { value: "70K+", label: "EU BTI rulings indexed" },
  { value: "< 60s", label: "Average first classification" },
  { value: "24/7", label: "Regulatory watch coverage" },
];

const platformPillars = [
  {
    title: "Classification Intelligence",
    description: "Find defensible CN/TARIC codes with AI reasoning grounded in official EU sources and BTI precedent context.",
    highlights: ["Image + text product intake", "Confidence indicators", "Alternative code candidates"],
    icon: Search
  },
  {
    title: "Compliance Operations",
    description: "Move from one-off checks to a repeatable operating system covering labels, supplier docs, and risk changes.",
    highlights: ["FI/SE label generation", "Supplier document vault", "Risk monitoring and alerts"],
    icon: FileCheck
  },
  {
    title: "Team-Ready Governance",
    description: "Give compliance, operations, and management a shared source of truth with traceable decisions and evidence.",
    highlights: ["Audit-ready decision records", "Organization roles and oversight", "Historical timeline and status"],
    icon: FileText,
  }
];

const workflowSteps = [
  {
    step: "01",
    title: "Upload Product Data",
    detail: "Add product image, materials, usage, and origin details to start a structured classification workflow.",
    icon: Search
  },
  {
    step: "02",
    title: "Receive Classification",
    detail: "Review top CN/TARIC candidates with rationale, confidence, and source-backed signals.",
    icon: CheckCircle2
  },
  {
    step: "03",
    title: "Generate Defense Dossier",
    detail: "Compile legal basis, references, and decision notes into a ready-to-share customs dossier.",
    icon: FileText
  },
  {
    step: "04",
    title: "Generate EU Label",
    detail: "Produce compliant FI/SE labels with required nutrition, allergen, and disclosure elements.",
    icon: Scale
  },
  {
    step: "05",
    title: "Manage Organization Workspace",
    detail: "Invite teammates, assign access, and monitor member activity across your compliance workflow.",
    icon: Users
  },
  {
    step: "06",
    title: "Prepare Audit Package",
    detail: "Export structured records to prove due diligence and defend classification choices.",
    icon: ClipboardCheck
  },
  {
    step: "07",
    title: "Track Shipment Risk",
    detail: "Monitor if regulatory shifts or document gaps could impact upcoming entries.",
    icon: Truck
  },
  {
    step: "08",
    title: "Maintain Living Compliance",
    detail: "Keep dossiers and labels current as rules, rulings, and product lines evolve.",
    icon: Shield
  }
];

const dataSourceLayers = [
  {
    name: "EU Combined Nomenclature (CN)",
    description: "Primary tariff classification framework maintained by the European Commission."
  },
  {
    name: "Binding Tariff Information (BTI) Rulings",
    description: "Legally binding precedent decisions from EU customs authorities used for consistency checks."
  },
  {
    name: "EU Court Decisions & Guidance",
    description: "Interpretive legal context that clarifies ambiguous or disputed classification outcomes."
  },
  {
    name: "National Authority Rules",
    description: "Market-level compliance requirements, including food and labeling obligations."
  }
];

const trustSignals = [
  {
    title: "Source Traceability",
    description: "Every output links back to the governing basis used in the recommendation.",
    icon: Database
  },
  {
    title: "Always-Current Monitoring",
    description: "Regulatory updates and newly published rulings can trigger proactive review paths.",
    icon: Shield
  },
  {
    title: "Audit-Ready Records",
    description: "Classification rationale, document evidence, and timeline snapshots stay exportable.",
    icon: Lock
  }
];

export function LandingContent({ user }: LandingContentProps) {
  const [isNavigating, setIsNavigating] = useState(false);
  const [cookiePolicyOpen, setCookiePolicyOpen] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [termsOfServiceOpen, setTermsOfServiceOpen] = useState(false);
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
    <div className="min-h-screen bg-background pt-20">
      {/* Navigation */}
      <nav className="fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="group transition-all duration-300 hover:opacity-80">
              <span className="text-2xl font-serif font-bold tracking-tight">
                Tulli<span className="text-primary">Check</span>
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
                href="#workflow" 
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("workflow");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Workflow
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
                href="#sources" 
                className="text-sm text-muted-foreground hover:text-foreground transition-all duration-300 relative group"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("sources");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Trust
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
                Sign In
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
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                EU IMPORT COMPLIANCE SOLVED
              </p>
              <h1 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3 leading-tight">
                Get Your Products <span className="text-primary">EU-Ready in Seconds</span>
              </h1>
              <p className="text-lg text-foreground/80 font-medium mb-4 leading-relaxed max-w-2xl">
                Stop risking fines, delays, and rejected shipments.
              </p>
              <p className="text-base text-muted-foreground mb-8 leading-relaxed max-w-2xl">
                Instantly classify products, generate compliant labels, and identify required documents using official EU customs data. No legal expertise required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  onClick={handleLoginClick}
                  className="transition-all duration-300 ease-out hover:scale-105 hover:shadow-lg hover:shadow-foreground/10"
                >
                  Get Started
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
              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
                    <p className="text-xl font-semibold tracking-tight">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation delay={200}>
            <div className="flex justify-center lg:justify-start">
              <ResultPreview />
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Problems & Solutions Section - Structured Document Style */}
      <section className="relative py-24 overflow-hidden bg-background">
        <div className="container mx-auto max-w-7xl px-6 relative z-10">
          <ScrollAnimation>
            <div className="mb-16 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                THE VALUE EQUATION
              </p>
              <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-2">
                Stop Guessing. Start Shipping.
              </h2>
            </div>
          </ScrollAnimation>

          {/* Column Headers */}
          <div className="grid lg:grid-cols-2 gap-0 mb-8 border-b-2 border-border">
            <div className="pb-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
                THE RISK
              </p>
            </div>
            <div className="pb-4 border-l-2 border-border pl-8 lg:pl-8">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-[0.15em]">
                HARMONIZEAI ADVANTAGE
              </p>
            </div>
          </div>

          {/* Structured Content Grid */}
          <div className="space-y-0">
            {/* Risk 1 → Advantage 1 */}
            <ScrollAnimation delay={100}>
              <div className="grid lg:grid-cols-2 gap-0 border-b border-border/50 py-8 group/item hover:bg-muted/20 transition-colors duration-300">
                {/* Risk Side */}
                <div className="pr-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-foreground/60 mb-2 group-hover/item:text-foreground/70 transition-colors">
                    Wrong CN / TARIC Classifications
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Manual classification is error-prone. A single incorrect digit in your CN code can lead to wrong duty rates, customs holds, or rejected entries.
                  </p>
                </div>

                {/* Advantage Side */}
                <div className="border-l-2 border-border pl-8 lg:pl-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-primary mb-2 group-hover/item:text-primary/90 transition-colors">
                    Instant, Audit-Ready Classifications
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Get accurate CN/TARIC codes in seconds. Our AI analyzes official EU data to provide clear reasoning and confidence scores, giving you the certainty you need without the research time.
                  </p>
                </div>
              </div>
            </ScrollAnimation>

            {/* Risk 2 → Advantage 2 */}
            <ScrollAnimation delay={200}>
              <div className="grid lg:grid-cols-2 gap-0 border-b border-border/50 py-8 group/item hover:bg-muted/20 transition-colors duration-300">
                {/* Risk Side */}
                <div className="pr-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-foreground/60 mb-2 group-hover/item:text-foreground/70 transition-colors">
                    Missing or Incomplete Documentation
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Incomplete invoices, certificates, or declarations can trigger inspections, delays, or refusal at EU customs.
                  </p>
                </div>

                {/* Advantage Side */}
                <div className="border-l-2 border-border pl-8 lg:pl-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-primary mb-2 group-hover/item:text-primary/90 transition-colors">
                    Know Exact Document Requirements
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Eliminate the guesswork. Instantly see exactly which invoices, certificates, and declarations are required for your specific product and origin to clear customs smoothly.
                  </p>
                </div>
              </div>
            </ScrollAnimation>

            {/* Risk 3 → Advantage 3 */}
            <ScrollAnimation delay={300}>
              <div className="grid lg:grid-cols-2 gap-0 border-b border-border/50 py-8 group/item hover:bg-muted/20 transition-colors duration-300">
                {/* Risk Side */}
                <div className="pr-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-foreground/60 mb-2 group-hover/item:text-foreground/70 transition-colors">
                    Non-Compliant Product Labels
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Incorrect language, missing allergens, or improper formatting can cause your goods to be blocked at the border.
                  </p>
                </div>

                {/* Advantage Side */}
                <div className="border-l-2 border-border pl-8 lg:pl-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-primary mb-2 group-hover/item:text-primary/90 transition-colors">
                    One-Click Compliant Labels
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Skip the design work. Generate fully compliant, bilingual (Finnish/Swedish) labels with all mandatory EU elements (allergens, nutrition, etc.) in a single click.
                  </p>
                </div>
              </div>
            </ScrollAnimation>

            {/* Risk 4 → Advantage 4 */}
            <ScrollAnimation delay={400}>
              <div className="grid lg:grid-cols-2 gap-0 border-b border-border/50 py-8 group/item hover:bg-muted/20 transition-colors duration-300">
                {/* Risk Side */}
                <div className="pr-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-foreground/60 mb-2 group-hover/item:text-foreground/70 transition-colors">
                    Regulatory Changes
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Updates to CN codes, tariffs, or EU food regulations can make existing classifications or labels outdated without warning.
                  </p>
                </div>

                {/* Advantage Side */}
                <div className="border-l-2 border-border pl-8 lg:pl-8">
                  <h3 className="text-lg font-serif font-semibold tracking-tight text-primary mb-2 group-hover/item:text-primary/90 transition-colors">
                    Automated Regulatory Watchdog
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Sleep soundly knowing we&apos;re watching the regulations for you. We automatically alert you if a tariff or requirement changes that impacts your specific products.
                  </p>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      <section id="features" className="container mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <ScrollAnimation>
          <div className="mb-14">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              PLATFORM
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              One Operating System for EU Import Compliance
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-3xl">
              Instead of disconnected tools, TulliCheck combines classification, documentation, labeling, and governance into one clear operating flow.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid gap-6 md:grid-cols-3">
          {platformPillars.map((pillar, index) => (
            <ScrollAnimation key={pillar.title} delay={100 + index * 100}>
              <div className="h-full rounded-2xl border border-border/40 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-xl font-serif font-semibold tracking-tight">{pillar.title}</h3>
                <p className="mb-5 text-sm text-muted-foreground leading-relaxed">{pillar.description}</p>
                <div className="space-y-2">
                  {pillar.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                      <p className="text-sm text-muted-foreground">{highlight}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </section>

      <section id="workflow" className="container mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <ScrollAnimation>
          <div className="mb-14">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              GUIDED WORKFLOW
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              From Product Intake to Audit Defense in One Guided Journey
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-3xl">
              A visual step-by-step process keeps teams aligned from initial product upload through classification, labels, organization management, and shipment risk tracking.
            </p>
          </div>
        </ScrollAnimation>

        <div className="relative">
          <div className="pointer-events-none absolute left-0 right-0 top-4 hidden h-px bg-border lg:block" />
          <div className="pointer-events-none absolute left-0 right-0 top-[calc(50%+20px)] hidden h-px bg-border lg:block" />
          <div className="grid gap-x-6 gap-y-10 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <ScrollAnimation key={step.step} delay={80 + index * 60}>
                <div className={`${index >= 4 ? "lg:pt-10" : ""}`}>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="text-xs font-semibold text-primary tracking-[0.15em]">{step.step}</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/50 bg-background">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    </span>
                    <step.icon className="h-4 w-4 text-primary/80" />
                  </div>
                  <h3 className="mb-1 text-lg font-serif font-semibold tracking-tight">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        </div>
      </section>

      <section id="sources" className="container mx-auto max-w-7xl scroll-mt-28 px-6 py-20">
        <ScrollAnimation>
          <div className="mb-14">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              DATA SOURCES & TRUST
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              Authoritative Inputs, Transparent Outputs
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-3xl">
              Every recommendation is built on public regulatory sources and presented with traceable evidence so teams can act confidently.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid gap-6 lg:grid-cols-2">
          <ScrollAnimation delay={100}>
            <div className="rounded-2xl border border-border/40 bg-card p-6">
              <h3 className="mb-5 text-xl font-serif font-semibold tracking-tight">Source Layers</h3>
              <div className="space-y-4">
                {dataSourceLayers.map((source) => (
                  <div key={source.name} className="rounded-xl border border-border/40 bg-background px-4 py-3">
                    <p className="text-sm font-semibold">{source.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{source.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="rounded-2xl border border-border/40 bg-card p-6">
              <h3 className="mb-5 text-xl font-serif font-semibold tracking-tight">Trust Controls</h3>
              <div className="space-y-4">
                {trustSignals.map((signal) => (
                  <div key={signal.title} className="rounded-xl border border-border/40 bg-background px-4 py-3">
                    <div className="mb-2 inline-flex rounded-md bg-primary/10 p-2 text-primary">
                      <signal.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold">{signal.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
                  </div>
                ))}
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
            Ready to prepare for EU import compliance?
          </h2>
          <p className="text-base text-muted-foreground italic mb-8">
            Designed for small and growing EU sellers who want clarity before shipping, not after goods are stopped.
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

      {/* Trust Disclaimer Section */}
      <section className="container mx-auto max-w-4xl px-6 py-12">
        <ScrollAnimation>
          <div className="border-t border-border/50 pt-12">
            <p className="text-sm text-muted-foreground leading-relaxed text-center max-w-3xl mx-auto">
              TulliCheck provides compliance support and decision assistance based on publicly available EU regulations and guidance. It does not replace customs authorities, Binding Tariff Information (BTI), or professional legal advice.
            </p>
          </div>
        </ScrollAnimation>
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
                <li><Link href="#workflow" className="hover:text-foreground transition-colors italic">Workflow Guidance</Link></li>
                <li><Link href="#sources" className="hover:text-foreground transition-colors italic">Audit Defense</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">Resources</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#sources" className="hover:text-foreground transition-colors italic">Data Sources</Link></li>
                <li><Link href="#sources" className="hover:text-foreground transition-colors italic">Reliability</Link></li>
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
            <p>© 2024 TulliCheck Technologies Inc. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <button 
                onClick={() => setPrivacyPolicyOpen(true)}
                className="hover:text-foreground transition-colors text-left"
              >
                Privacy Policy
              </button>
              <button 
                onClick={() => setTermsOfServiceOpen(true)}
                className="hover:text-foreground transition-colors text-left"
              >
                Terms of Service
              </button>
              <button 
                onClick={() => setCookiePolicyOpen(true)}
                className="hover:text-foreground transition-colors text-left"
              >
                Cookie Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      <CookiePolicyDialog open={cookiePolicyOpen} onOpenChange={setCookiePolicyOpen} />
      <PrivacyPolicyDialog open={privacyPolicyOpen} onOpenChange={setPrivacyPolicyOpen} />
      <TermsOfServiceDialog open={termsOfServiceOpen} onOpenChange={setTermsOfServiceOpen} />
    </div>
  );
}
