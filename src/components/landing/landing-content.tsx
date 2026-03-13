"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { ResultPreview } from "@/components/landing/result-preview";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { CookiePolicyDialog } from "@/components/legal/cookie-policy-dialog";
import { PrivacyPolicyDialog } from "@/components/legal/privacy-policy-dialog";
import { TermsOfServiceDialog } from "@/components/legal/terms-of-service-dialog";
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
  AlertTriangle,
  Waypoints,
  XCircle,
  ArrowRight,
  Calendar,
  Loader2
} from "lucide-react";

type LandingRuling = {
  id: string;
  market: string;
  reference: string;
  title: string;
  body: string;
  originalBody: string;
  isTranslated: boolean;
  category: string | null;
  htsCode: string | null;
  issuedAt: string | null;
  justification: string | null;
  originalJustification: string | null;
};

function toFlagEmoji(countryCode: string) {
  const cc = (countryCode || "").toUpperCase();
  if (cc.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  const codePoints = [A + (cc.charCodeAt(0) - base), A + (cc.charCodeAt(1) - base)];
  return String.fromCodePoint(...codePoints);
}

const HERO_MORPH_PATH_A =
  "M63.8,-49.6C80.6,-28.8,90.3,-2.6,84.2,19.5C78.2,41.5,56.4,59.3,33.2,67.2C10,75.1,-14.6,73.1,-35.6,62.1C-56.6,51.1,-74,31.1,-79.2,8.4C-84.3,-14.3,-77.3,-39.7,-61.2,-60.2C-45.1,-80.7,-20,-96.2,1.9,-97.7C23.8,-99.2,47.6,-86.2,63.8,-49.6Z";
const HERO_MORPH_PATH_B =
  "M60.7,-45.5C76.7,-28.7,86.4,-2.3,81.1,20.8C75.9,43.9,55.7,63.7,31.9,74.1C8.1,84.6,-19.2,85.6,-38.8,74.5C-58.4,63.5,-70.3,40.5,-74.3,17.2C-78.3,-6.1,-74.4,-29.6,-61.1,-46.6C-47.9,-63.6,-24.9,-74.2,-1.2,-73.2C22.5,-72.1,44.9,-59.3,60.7,-45.5Z";

const RULING_SUGGESTIONS = [
  { label: "Energy drink concentrate", query: "energy drink" },
  { label: "Gluten-free pasta", query: "pasta" },
  { label: "1905 90 60", query: "1905 90 60" },
  { label: "Electric vehicles", query: "electric vehicles" },
] as const;

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
  const [cookiePolicyOpen, setCookiePolicyOpen] = useState(false);
  const [privacyPolicyOpen, setPrivacyPolicyOpen] = useState(false);
  const [termsOfServiceOpen, setTermsOfServiceOpen] = useState(false);
  const router = useRouter();
  const heroRef = useRef<HTMLElement | null>(null);
  const magneticWrapRef = useRef<HTMLDivElement | null>(null);
  const morphPathRef = useRef<SVGPathElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [teaserRulings, setTeaserRulings] = useState<LandingRuling[]>([]);
  const [teaserLoading, setTeaserLoading] = useState(true);

  const [rulingsQuery, setRulingsQuery] = useState("");
  const [rulingsTouched, setRulingsTouched] = useState(false);
  const [rulingsLoading, setRulingsLoading] = useState(false);
  const [rulingsError, setRulingsError] = useState<string | null>(null);
  const [rulings, setRulings] = useState<LandingRuling[]>([]);
  const [selectedRuling, setSelectedRuling] = useState<LandingRuling | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerShowOriginal, setDrawerShowOriginal] = useState(false);

  const normalizedQuery = useMemo(() => rulingsQuery.trim(), [rulingsQuery]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const apply = () => setPrefersReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const alreadyPlayed = sessionStorage.getItem("tc_hero_morph_played");
    if (alreadyPlayed) return;
    sessionStorage.setItem("tc_hero_morph_played", "1");

    let cancelled = false;
    (async () => {
      const mod = await import("gsap");
      if (cancelled) return;
      const gsap = mod.gsap;
      const path = morphPathRef.current;
      if (!gsap || !path) return;
      gsap.set(path, { attr: { d: HERO_MORPH_PATH_A } });
      gsap.to(path, {
        duration: 1.2,
        attr: { d: HERO_MORPH_PATH_B },
        ease: "power2.out",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const container = heroRef.current;
    if (!container || prefersReducedMotion) return;

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const y = window.scrollY || 0;
        container.style.setProperty("--parallax-y-1", `${y * 0.08}px`);
        container.style.setProperty("--parallax-y-2", `${y * 0.14}px`);
        container.style.setProperty("--parallax-y-3", `${y * 0.2}px`);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const supportsIdle =
      typeof window !== "undefined" &&
      "requestIdleCallback" in window &&
      "cancelIdleCallback" in window;

    let idleId: number | null = null;
    let timeoutId: number | null = null;

    const schedule = (cb: () => void) => {
      if (supportsIdle) {
        idleId = (window as any).requestIdleCallback(cb, { timeout: 1500 });
        return;
      }
      timeoutId = window.setTimeout(cb, 700);
    };

    schedule(async () => {
      try {
        setTeaserLoading(true);
        const res = await fetch("/api/rulings?market=FI&limit=3");
        if (!res.ok) throw new Error("Failed to load rulings");
        const data = await res.json();
        const list = Array.isArray(data?.rulings) ? (data.rulings as LandingRuling[]) : [];
        setTeaserRulings(list.slice(0, 3));
      } catch {
        setTeaserRulings([]);
      } finally {
        setTeaserLoading(false);
      }
    });

    return () => {
      if (idleId != null && supportsIdle) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    if (!rulingsTouched) return;
    if (normalizedQuery.length === 0) {
      setRulings([]);
      setRulingsError(null);
      return;
    }

    setRulingsError(null);
    const handle = window.setTimeout(async () => {
      try {
        setRulingsLoading(true);
        searchAbortRef.current?.abort();
        const controller = new AbortController();
        searchAbortRef.current = controller;
        const url = `/api/rulings?market=FI&limit=12&includeRelated=1&search=${encodeURIComponent(normalizedQuery)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const list = Array.isArray(data?.rulings) ? (data.rulings as LandingRuling[]) : [];
        setRulings(list);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        setRulingsError("Could not load rulings right now.");
      } finally {
        setRulingsLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [normalizedQuery, rulingsTouched]);

  const handleMagneticMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const el = magneticWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const max = 10;
    const mx = Math.max(-max, Math.min(max, x * 0.12));
    const my = Math.max(-max, Math.min(max, y * 0.12));
    el.style.setProperty("--mx", `${mx.toFixed(2)}px`);
    el.style.setProperty("--my", `${my.toFixed(2)}px`);
  };

  const handleMagneticLeave = () => {
    const el = magneticWrapRef.current;
    if (!el) return;
    el.style.setProperty("--mx", `0px`);
    el.style.setProperty("--my", `0px`);
  };

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
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={32}
                      height={32}
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

      <section
        ref={(el) => {
          heroRef.current = el;
        }}
        className="relative overflow-hidden hero-animated-bg"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="hero-gradient-layer" />
          <div className="hero-grid-layer parallax-layer parallax-layer-1" />
          <div className="hero-glow-layer parallax-layer parallax-layer-2" />
        </div>
        <div className="container mx-auto max-w-7xl px-6 py-16 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <ScrollAnimation className="relative">
              <div className="relative">
                <div className="absolute -top-16 -left-12 h-48 w-48 opacity-80 pointer-events-none">
                  <svg viewBox="0 0 200 200" className="h-full w-full">
                    <path ref={morphPathRef} transform="translate(100 100)" fill="currentColor" className="text-primary/15" />
                  </svg>
                </div>

                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  EU IMPORT COMPLIANCE SOLVED
                </p>
                <h1 className="text-4xl md:text-5xl font-serif font-bold tracking-tight mb-4 leading-[1.05]">
                  EU import decisions that feel{" "}
                  <span className="relative inline-block">
                    instant
                    <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-primary/40 rounded-full" />
                  </span>
                  .
                </h1>
                <p className="text-lg text-foreground/80 font-medium mb-3 leading-relaxed max-w-2xl">
                  Stop risking fines, delays, and rejected shipments.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                  Instantly classify products, generate compliant labels, and identify required documents using official EU customs data. No legal expertise required.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start">
                  <div
                    ref={magneticWrapRef}
                    onPointerMove={handleMagneticMove}
                    onPointerLeave={handleMagneticLeave}
                    className="magnetic-wrap"
                  >
                    <Button size="lg" onClick={handleLoginClick} className="magnetic-target">
                      Try for free <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="lg"
                    variant="outline"
                    className="transition-all duration-300 ease-out hover:scale-[1.02] hover:bg-foreground hover:text-background hover:border-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      const element = document.getElementById("live-rulings");
                      element?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Explore rulings
                  </Button>
                </div>

                <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3 py-1.5 backdrop-blur">
                    <Database className="h-3.5 w-3.5 text-primary" />
                    70K+ EU BTI rulings indexed
                  </div>
              
                  <div className="flex items-center gap-2 rounded-full border border-border/50 bg-background/70 px-3 py-1.5 backdrop-blur">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    Audit-ready reasoning
                  </div>
                </div>

                <div className="mt-6 max-w-md">
                  <div className="perspective-1000">
                    <div className="teaser-tilt-card rounded-2xl border border-border/50 bg-background/80 backdrop-blur shadow-lg">
                      <div className="px-5 pt-5 pb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Database className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rulings DB</p>
                              <p className="text-sm font-semibold">Real BTI precedent</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            Live
                          </Badge>
                        </div>
                      </div>

                      <div className="px-5 pb-5">
                        <div className="teaser-scroll-viewport">
                          <ul className={`teaser-scroll-track ${prefersReducedMotion ? "" : "teaser-scroll"}`}>
                            {(teaserLoading
                              ? Array.from({ length: 3 }).map((_, idx) => ({
                                  id: `placeholder-${idx}`,
                                  market: "FI",
                                  reference: "Loading…",
                                  title: "Fetching official rulings",
                                  body: "",
                                  originalBody: "",
                                  isTranslated: false,
                                  category: null,
                                  htsCode: null,
                                  issuedAt: null,
                                  justification: null,
                                  originalJustification: null,
                                }))
                              : teaserRulings
                            ).map((ruling) => (
                              <li key={ruling.id} className="teaser-item">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-muted text-sm">
                                    <span aria-hidden="true">{toFlagEmoji(ruling.market)}</span>
                                    <span className="sr-only">{ruling.market}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">
                                      {ruling.reference} {ruling.htsCode ? `• ${ruling.htsCode}` : ""}
                                    </p>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {ruling.title}
                                    </p>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <p className="text-[11px] text-muted-foreground">Evidence base examples</p>
                          <button
                            type="button"
                            onClick={() => {
                              const element = document.getElementById("live-rulings");
                              element?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            className="text-[11px] font-medium text-primary hover:underline"
                          >
                            View examples
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollAnimation>

            <ScrollAnimation delay={200} className="relative">
              <div className="mt-10 relative flex justify-center lg:justify-start">
                <div className="relative z-10">
                  <ResultPreview />
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* <section id="live-rulings" className="relative py-20">
        <div className="container mx-auto max-w-7xl px-6">
          <ScrollAnimation>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  LIVE BTI RULINGS
                </p>
                <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-2">
                  Search real precedent in seconds
                </h2>
                <p className="text-sm text-muted-foreground italic max-w-2xl">
                  This is a lightweight sample search. For deep research, open the full Ruling Database.
                </p>
              </div>
              <div className="flex gap-3">
                <Badge variant="secondary" className="rounded-full px-4 py-1.5">
                  FI market default
                </Badge>
                <Badge variant="outline" className="rounded-full px-4 py-1.5">
                  Debounced 300ms
                </Badge>
              </div>
            </div>
          </ScrollAnimation>

          <ScrollAnimation delay={200}>
            <div className="rounded-3xl border border-border/60 bg-background/80 backdrop-blur shadow-sm overflow-hidden">
              <div className="p-5 md:p-7 border-b border-border/50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="relative w-full md:max-w-xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchInputRef}
                      value={rulingsQuery}
                      onChange={(e) => setRulingsQuery(e.target.value)}
                      onFocus={() => setRulingsTouched(true)}
                      placeholder="Try: energy drink, 1905 90 60, electric vehicles…"
                      className="pl-10 h-11 rounded-xl bg-background"
                      aria-label="Search BTI rulings"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      Official EU records
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      Evidence base
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {RULING_SUGGESTIONS.map((s) => (
                    <Button
                      key={s.query}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        setRulingsTouched(true);
                        setRulingsQuery(s.query);
                        searchInputRef.current?.focus();
                      }}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-5 md:p-7">
                {rulingsError ? (
                  <div className="text-sm text-muted-foreground">{rulingsError}</div>
                ) : rulingsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : rulingsTouched && normalizedQuery.length > 0 && rulings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No results for <span className="font-medium text-foreground">{normalizedQuery}</span>.
                  </div>
                ) : rulings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    Pick an example above or type a product / HS code to see precedent.
                  </div>
                ) : (
                  <div
                    className="grid gap-4"
                    style={{
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    }}
                  >
                    {rulings.map((r) => (
                      <Card key={r.id} className="group hover:bg-muted/40 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg" aria-hidden="true">
                                  {toFlagEmoji(r.market)}
                                </span>
                                <span className="sr-only">{r.market}</span>
                                <p className="text-xs text-muted-foreground truncate">{r.reference}</p>
                              </div>
                              <p className="font-serif font-semibold tracking-tight leading-snug line-clamp-2">
                                {r.title}
                              </p>
                            </div>
                            {r.category ? (
                              <Badge variant="secondary" className="shrink-0">
                                {r.category}
                              </Badge>
                            ) : null}
                          </div>

                          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : "—"}
                            {r.htsCode ? <span className="ml-2 font-mono">{r.htsCode}</span> : null}
                          </div>

                          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                            {r.body}
                          </p>

                          <div className="mt-4 flex items-center justify-between">
                            <Button
                              type="button"
                              variant="link"
                              className="px-0 text-primary"
                              onClick={() => {
                                setSelectedRuling(r);
                                setDrawerShowOriginal(false);
                                setDrawerOpen(true);
                              }}
                            >
                              View details <ArrowRight className="h-4 w-4" />
                            </Button>
                            <span className="text-xs text-muted-foreground">{r.isTranslated ? "EN available" : "Original only"}</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Results are informational and non-binding. Final decisions rest with EU customs authorities
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={(e) => {
                      e.preventDefault();
                      router.push("/rulings");
                    }}
                  >
                    Open full database
                  </Button>
                </div>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section> */}

      {/* Problems & Solutions Section - Structured Document Style */}
      <section className="relative py-24 overflow-hidden bg-background">
        <div className="container mx-auto max-w-7xl px-6 relative z-10">
          <ScrollAnimation>
            <div className="mb-16 text-center">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                FROM RISK TO READY
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

      {/* Features Section */}
      <section id="features" className="container mx-auto max-w-7xl px-6 py-20">
        <ScrollAnimation>
          <div className="mb-16">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              PLATFORM
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              Everything You Need to Prepare for EU Import Compliance
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-2xl">
              A practical set of tools designed to help small and growing EU sellers reduce uncertainty and prepare compliant imports with confidence.
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
                  Automated Product Classification
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Upload product descriptions and images to receive AI-assisted CN/TARIC classification suggestions based on product characteristics and official EU guidance.
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
                  Monitor your products against regulatory updates, classification changes, and enforcement trends that may increase customs risk.
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
                  Compliance Documentation Records
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Maintain structured records explaining how classifications were determined, including referenced sources and timestamps, to demonstrate due diligence if questions arise.
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
                  Product Labeling for EU Markets
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Create bilingual (FI/SE) labels with required EU food information, including ingredients, allergens, nutrition tables, and mandatory disclosures. Export-ready for print.
                </p>
              </div>
            </div>
          </div>

          <div className="stagger-fade-in group border-b border-border/30 pb-8 transition-all duration-500 ease-out hover:border-border/60 hover:pb-10 cursor-default" style={{ animationDelay: '600ms' }}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3">
                <Lock className="h-6 w-6 text-primary transition-all duration-500 group-hover:text-foreground" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                  Compliance Vault
                </h3>
                <p className="text-base text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                  Request required compliance documents from suppliers with a simple, secure link. All documents are stored in an encrypted vault, ensuring your import documentation is organized, accessible, and protected for EU customs requirements.
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              DATA SOURCES
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              Built on Official EU Regulatory Sources
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-2xl">
              TulliCheck relies exclusively on authoritative public data maintained by EU institutions and national authorities.
            </p>
          </div>
        </ScrollAnimation>

        <div className="space-y-12">
          <ScrollAnimation delay={100}>
            <div className="group border-l-4 border-primary/20 pl-6 transition-all duration-500 ease-out hover:border-primary/60 hover:pl-8 hover:bg-muted/30 -ml-2 py-2 rounded-r-md cursor-default">
              <h3 className="text-xl font-serif font-semibold tracking-tight mb-2 transition-all duration-500 group-hover:translate-x-1">
                EU Combined Nomenclature (CN)
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
                EU Court Decisions & Classification Guidance
              </h3>
              <p className="text-sm text-muted-foreground italic transition-colors duration-500 group-hover:text-foreground/80">
                Judicial interpretations and historical classification cases
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
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              RELIABILITY
            </p>
            <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight mb-3">
              Continuously Updated, Always Current
            </h2>
            <p className="text-sm text-muted-foreground italic max-w-2xl">
              Classifications and requirements are continuously checked against new rulings, regulatory updates, and published guidance.
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
                    Real-Time Regulatory Updates
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Automatic monitoring of changes to CN codes, tariffs, and EU food regulations that may impact your products.
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
                    Confidence Indicators
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Each classification includes confidence signals based on data alignment, supporting guidance, and precedent strength.
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
                    Transparent Audit Trail
                  </h3>
                  <p className="text-sm text-muted-foreground italic leading-relaxed transition-colors duration-500 group-hover:text-foreground/80">
                    Every decision is logged with sources, reasoning, and timestamps to support internal review and compliance checks.
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

      <Dialog
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setSelectedRuling(null);
        }}
      >
        <DialogContent className="!fixed !right-0 !top-0 !left-auto !bottom-0 !translate-x-0 !translate-y-0 h-dvh w-full max-w-xl rounded-none border-l bg-background p-0 shadow-2xl data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right">
          {selectedRuling ? (
            <div className="flex h-dvh flex-col">
              <div className="border-b border-border/60 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="text-base" aria-hidden="true">
                        {toFlagEmoji(selectedRuling.market)}
                      </span>
                      <span className="sr-only">{selectedRuling.market}</span>
                      <span className="truncate">{selectedRuling.reference}</span>
                      {selectedRuling.htsCode ? <span className="font-mono">{selectedRuling.htsCode}</span> : null}
                    </div>
                    <DialogHeader>
                      <DialogTitle className="font-serif leading-snug">
                        {selectedRuling.title}
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        {selectedRuling.issuedAt ? (
                          <span className="inline-flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Issued {new Date(selectedRuling.issuedAt).toLocaleDateString()}
                          </span>
                        ) : (
                          "Issued date not available"
                        )}
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                  {selectedRuling.isTranslated ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setDrawerShowOriginal((v) => !v)}
                    >
                      {drawerShowOriginal ? "View translation" : "View original"}
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedRuling.category ? <Badge variant="secondary">{selectedRuling.category}</Badge> : null}
                  <Badge variant="outline">{selectedRuling.market}</Badge>
                  <Badge variant="outline">{selectedRuling.isTranslated ? "EN available" : "Original only"}</Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    Description
                  </h3>
                  <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {drawerShowOriginal ? selectedRuling.originalBody : selectedRuling.body}
                  </p>
                </div>
                {selectedRuling.justification ? (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Legal reasoning
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                      {drawerShowOriginal ? selectedRuling.originalJustification : selectedRuling.justification}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border/60 p-6 flex items-center justify-between gap-4">
                <p className="text-xs text-muted-foreground">
                  Informational and non-binding.
                </p>
                <Button
                  type="button"
                  onClick={() => {
                    router.push(`/rulings/${selectedRuling.id}`);
                  }}
                  className="rounded-xl"
                >
                  View in database <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

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
