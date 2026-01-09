import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const pillars = [
  {
    title: "GRI Engine",
    description:
      "Vector search that prioritizes legal notes, executes chapter to subheading reasoning, and enforces human review below 80% confidence.",
  },
  {
    title: "Reasoning Dossier",
    description:
      "Auto-generated PDF citing GRI rules, CROSS or BTI rulings, and exclusion logic as a defensible audit trail.",
  },
  {
    title: "Compliance Vault",
    description:
      "Tagged storage for lab tests, supplier attestations, and dossiers with file hashing for immutability.",
  },
  {
    title: "Duty Calculator",
    description:
      "Market-specific duty, VAT, MPF, and Section 301 flags with margin-ready cost outputs.",
  },
];

const deliverables = [
  { item: "Next.js 16 App Router scaffold with TypeScript", status: "Complete" },
  { item: "Tailwind v4 + Shadcn UI system", status: "Complete" },
  { item: "Prisma + Supabase client layers", status: "Complete" },
  { item: "Env contract for database and Supabase keys", status: "Complete" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-16 lg:px-12">
        <div className="space-y-6 text-center">
          <Badge variant="outline" className="mx-auto w-fit px-4 py-1 text-sm">
            Phase 1 · Platform setup
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              HarmonizeAI for compliant global commerce
            </h1>
            <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
              Infrastructure ready for AI-driven HTS classification, reasoning
              dossiers, and compliance vault workflows built for Shopify, Amazon
              FBA, and cross-border importers.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button asChild className="h-12 px-8 text-base">
              <Link href="https://ui.shadcn.com" target="_blank">
                UI system
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 px-8 text-base">
              <Link href="https://www.prisma.io" target="_blank">
                Data layer
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {pillars.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <CardTitle>{pillar.title}</CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Phase 1 Deliverables</CardTitle>
            <CardDescription>
              Foundation ready for Supabase provisioning and feature
              development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverables.map((deliverable) => (
                  <TableRow key={deliverable.item}>
                    <TableCell className="font-medium">
                      {deliverable.item}
                    </TableCell>
                    <TableCell className="text-right text-sm text-primary">
                      {deliverable.status}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
