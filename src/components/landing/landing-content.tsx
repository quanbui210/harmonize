"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { ResultPreview } from "@/components/landing/result-preview";
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

export function LandingContent() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image 
                src="/appicon.svg" 
                alt="HarmonizeAI" 
                width={32} 
                height={32}
                className="h-8 w-8"
              />
              <span className="text-xl font-semibold tracking-tight">HarmonizeAI</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <a 
                href="#features" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("features");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Platform
              </a>
              <a 
                href="#sources" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("sources");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Data Sources
              </a>
              <a 
                href="#reliability" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  const element = document.getElementById("reliability");
                  element?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Reliability
              </a>
              <Link 
                href="/login?redirectTo=/dashboard" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Login
              </Link>
            </div>
            <Button asChild>
              <Link href="/login?redirectTo=/dashboard">Get Started</Link>
            </Button>
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
                HarmonizeAI automates HTS code verification and provides bulletproof audit protection 
                for modern B2B importers. Every classification is backed by official EU regulations, 
                binding rulings, and defensible legal reasoning.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" asChild>
                  <Link href="/login?redirectTo=/dashboard">Start Risk Scan</Link>
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    const element = document.getElementById("sources");
                    element?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  Learn More
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-12 uppercase tracking-wider italic">
                Trusted by 200+ Global Logistics Partners
              </p>
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
          <ScrollAnimation delay={100}>
            <div className="border-b border-border/30 pb-8">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <Search className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2">
                    Automated HTS Classification
                  </h3>
                  <p className="text-base text-muted-foreground italic leading-relaxed">
                    Upload product images and descriptions to receive instant, AI-powered HTS code classifications. 
                    Our system analyzes product characteristics against the Harmonized System Tariff and provides 
                    detailed legal reasoning for every classification decision.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="border-b border-border/30 pb-8">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2">
                    Risk Monitoring & Alerts
                  </h3>
                  <p className="text-base text-muted-foreground italic leading-relaxed">
                    Continuous monitoring of your classifications against regulatory changes, binding rulings, 
                    and enforcement actions. Receive proactive alerts when your products may be at risk of 
                    customs challenges.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300}>
            <div className="border-b border-border/30 pb-8">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <FileCheck className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2">
                    Audit Defense Dossiers
                  </h3>
                  <p className="text-base text-muted-foreground italic leading-relaxed">
                    Generate comprehensive defense dossiers that document your classification decisions with 
                    legal precedents, binding rulings, and detailed reasoning. Every dossier is designed to 
                    withstand customs authority scrutiny.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={400}>
            <div className="border-b border-border/30 pb-8">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <Scale className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2">
                    Product Labeling
                  </h3>
                  <p className="text-base text-muted-foreground italic leading-relaxed">
                    Generate compliant bilingual (Finnish/Swedish) product labels with nutrition tables, 
                    ingredient lists, allergen warnings, and all mandatory EU requirements. Labels can be 
                    exported as PDF or SVG for printing.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>
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
            <div className="border-l-4 border-primary/20 pl-6">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                EU Combined Nomenclature
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Official tariff classification system maintained by the European Commission
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="border-l-4 border-primary/20 pl-6">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                Binding Tariff Information (BTI) Rulings
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Legally binding classification decisions issued by EU customs authorities
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300}>
            <div className="border-l-4 border-primary/20 pl-6">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                Court Decisions & Legal Precedents
              </h3>
              <p className="text-sm text-muted-foreground italic">
                Historical classification cases and judicial interpretations from EU courts
              </p>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={400}>
            <div className="border-l-4 border-primary/20 pl-6">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                Finnish Food Authority (Ruokavirasto)
              </h3>
              <p className="text-sm text-muted-foreground italic">
                <a 
                  href="https://www.ruokavirasto.fi/en/foodstuffs/food-sector/instructions-and-legislation/#labelling" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
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

        <div className="space-y-12">
          <ScrollAnimation delay={100}>
            <div className="border-l-4 border-primary/20 pl-6">
              <div className="flex items-start gap-4">
                <Shield className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                    Real-Time Updates
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    Automatic monitoring of regulatory changes and new binding rulings that may affect 
                    your existing classifications.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="border-l-4 border-primary/20 pl-6">
              <div className="flex items-start gap-4">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                    Confidence Scoring
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    Every classification includes a confidence score based on the strength of supporting 
                    legal precedents and regulatory alignment.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={300}>
            <div className="border-l-4 border-primary/20 pl-6">
              <div className="flex items-start gap-4">
                <Database className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-xl font-serif font-semibold tracking-tight mb-2">
                    Audit Trail
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
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
            <Button size="lg" asChild>
              <Link href="/login?redirectTo=/dashboard">Start Your Free Risk Scan</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login?redirectTo=/dashboard">Talk to an Expert</Link>
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
              <Link href="/" className="flex items-center gap-2 mb-4">
                <Image 
                  src="/appicon.svg" 
                  alt="HarmonizeAI" 
                  width={24} 
                  height={24}
                  className="h-6 w-6"
                />
                <span className="font-semibold">HarmonizeAI</span>
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

