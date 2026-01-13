import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertCircle
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded bg-primary"></div>
              <span className="text-xl font-semibold tracking-tight">HarmonizeAI</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Platform
              </Link>
              <Link href="#sources" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Data Sources
              </Link>
              <Link href="#reliability" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Reliability
              </Link>
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Login
              </Link>
            </div>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto max-w-7xl px-6 py-20 md:py-32">
        <div className="max-w-3xl">
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
              <Link href="/login">Start Risk Scan</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#sources">Learn More</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-12 uppercase tracking-wider italic">
            Trusted by 200+ Global Logistics Partners
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto max-w-7xl px-6 py-20">
        <div className="mb-16">
          <h2 className="text-4xl font-serif font-semibold tracking-tight mb-3">
            Engineered for Compliance
          </h2>
          <p className="text-base text-muted-foreground italic max-w-2xl">
            Our platform covers every stage of your supply chain with legal-grade precision.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="font-serif">Sourcing</CardTitle>
              <CardDescription className="italic">
                AI-powered classification for new product lines to ensure early compliance 
                and accurate margin forecasting before orders are placed.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="font-serif">Shipping</CardTitle>
              <CardDescription className="italic">
                Real-time compliance checks integrated into your global logistics workflow. 
                Automatic document generation for customs clearance.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="font-serif">Audit Defense</CardTitle>
              <CardDescription className="italic">
                Generate defensible reasoning dossiers for every shipment to withstand any audit. 
                Backed by specific GRI rules and legal precedents.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* Data Sources Section */}
      <section id="sources" className="bg-muted/30 py-20">
        <div className="container mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              DATA SOURCES & RELIABILITY
            </p>
            <h2 className="text-4xl font-serif font-semibold tracking-tight mb-3">
              Built on Official Data Sources
            </h2>
            <p className="text-base text-muted-foreground italic">
              Every classification is grounded in authoritative legal sources and official 
              EU regulations. Transparency and accuracy are fundamental to our platform.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <BookOpen className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">EU Combined Nomenclature</CardTitle>
                <CardDescription className="italic">
                  Official 8-digit CN codes and descriptions from the European Commission TARIC database. 
                  Updated annually with the latest tariff structure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Source: European Commission TARIC</p>
                  <p>• Format: Official XML/CSV via TARIC API</p>
                  <p>• Coverage: All 8-digit CN codes</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Scale className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">Regulation (EU) 2021/1832</CardTitle>
                <CardDescription className="italic">
                  Official Explanatory Notes providing detailed classification rules, 
                  chapter notes, heading notes, and legal guidance for accurate classification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Source: EUR-Lex Official Journal</p>
                  <p>• Coverage: Chapter and heading notes</p>
                  <p>• Access: Vector search via pgvector</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <FileCheck className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">Binding Tariff Information</CardTitle>
                <CardDescription className="italic">
                  Precedents from EU customs authorities (BTI rulings) that establish 
                  binding classification decisions for similar products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Source: EU Customs Authorities</p>
                  <p>• Status: Legally binding precedents</p>
                  <p>• Application: Similar product matching</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Database className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">TARIC Duty Rates</CardTitle>
                <CardDescription className="italic">
                  Real-time duty rates, VAT rates, quotas, and additional measures 
                  (anti-dumping, safeguards) from the official TARIC system.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Source: TARIC API (SOAP/REST)</p>
                  <p>• Updates: Real-time synchronization</p>
                  <p>• Coverage: All EU member states</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Globe className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">General Rules of Interpretation</CardTitle>
                <CardDescription className="italic">
                  EU GRI engine implementing the six General Rules for Interpretation 
                  of the Harmonized System for systematic classification logic.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Source: WCO Harmonized System</p>
                  <p>• Implementation: Custom GRI engine</p>
                  <p>• Coverage: Rules 1-6 with precedence</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                  <Lock className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif text-xl">Legal Source Citations</CardTitle>
                <CardDescription className="italic">
                  Every classification includes specific citations to legal sources, 
                  chapter notes, and binding rulings that support the determination.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• Format: Structured legal citations</p>
                  <p>• Traceability: Full source attribution</p>
                  <p>• Audit-ready: Complete documentation</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Reliability Section */}
      <section id="reliability" className="container mx-auto max-w-7xl px-6 py-20">
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            AUDIT TRANSPARENCY & RELIABILITY
          </p>
          <h2 className="text-4xl font-serif font-semibold tracking-tight mb-3">
            Total Audit Transparency
          </h2>
          <p className="text-base text-muted-foreground italic">
            Every HTS code classification is backed by a generated Reasoning Dossier, 
            citing specific General Rules for Interpretation (GRI) and binding rulings. 
            No more black-box AI.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-700" />
                </div>
                <CardTitle className="font-serif">Defensible Reasoning</CardTitle>
              </div>
              <CardDescription className="text-base italic">
                Each classification includes a complete legal rationale explaining why 
                a specific CN code was selected, which GRI rules were applied, and 
                which legal precedents support the determination.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Step-by-step classification logic</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>GRI rule application sequence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Exclusion proofs (negative tests)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Binding ruling references</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-700" />
                </div>
                <CardTitle className="font-serif">Confidence Scoring</CardTitle>
              </div>
              <CardDescription className="text-base italic">
                Our AI provides confidence scores based on the strength of legal 
                precedents, clarity of product description, and alignment with 
                official classification guidance.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Multi-candidate ranking (top 3-5 codes)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Confidence percentage per candidate</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Risk flagging for ambiguous cases</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Manual review recommendations</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/30">
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-700" />
              </div>
              <CardTitle className="font-serif">Continuous Validation</CardTitle>
            </div>
            <CardDescription className="text-base italic">
              Our system validates classifications against multiple data sources and 
              cross-references with official databases to ensure accuracy and compliance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="font-semibold mb-2 text-sm">Data Validation</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• CN code format validation</li>
                  <li>• Chapter consistency checks</li>
                  <li>• Product type alignment</li>
                  <li>• Duty rate verification</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-2 text-sm">Quality Assurance</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• RAG-enhanced legal search</li>
                  <li>• Vector similarity matching</li>
                  <li>• Binding ruling cross-reference</li>
                  <li>• Historical classification patterns</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="bg-primary/5 py-20">
        <div className="container mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-4xl font-serif font-semibold tracking-tight mb-3">
            Ready to secure your global imports?
          </h2>
          <p className="text-base text-muted-foreground italic mb-8">
            Join 1,000+ compliance officers who trust HarmonizeAI for their audit protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/login">Start Your Free Risk Scan</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Talk to an Expert</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background">
        <div className="container mx-auto max-w-7xl px-6 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-6 w-6 rounded bg-primary"></div>
                <span className="font-semibold">HarmonizeAI</span>
              </div>
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
                <li><Link href="/login" className="hover:text-foreground transition-colors italic">Documentation</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wider text-muted-foreground">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground transition-colors italic">About Us</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors italic">Legal</Link></li>
                <li><Link href="/login" className="hover:text-foreground transition-colors italic">Contact</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col sm:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>© 2024 HarmonizeAI Technologies Inc. All rights reserved.</p>
            <div className="flex gap-6 mt-4 sm:mt-0">
              <Link href="/login" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/login" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <Link href="/login" className="hover:text-foreground transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
