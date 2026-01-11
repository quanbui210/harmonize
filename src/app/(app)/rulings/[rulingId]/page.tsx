import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import { getRulingAction } from "@/server/actions/rulings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Hash, Calendar, ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
function formatCNCode(cnCode: string): string {
  if (!cnCode || cnCode.length !== 8) return cnCode;
  return `${cnCode.substring(0, 4)} ${cnCode.substring(4, 6)} ${cnCode.substring(6, 8)}`;
}
import ReactMarkdown from "react-markdown";

type Props = {
  params: { rulingId: string };
};

export default async function RulingDetailPage({ params }: Props) {
  const user = await requireAuthenticatedUser();
  const membership = await getPrimaryMembership(user.id);

  if (!membership) {
    redirect("/login?error=organization");
  }

  let ruling;
  try {
    ruling = await getRulingAction(params.rulingId);
  } catch (error) {
    redirect("/rulings");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rulings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rulings
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{ruling.market}</Badge>
                <span className="font-mono text-lg font-semibold text-blue-600">
                  {ruling.reference}
                </span>
              </div>
              <CardTitle className="text-2xl">{ruling.title}</CardTitle>
              <CardDescription>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    <span className="font-mono">
                      {ruling.htsCode.length === 10
                        ? formatCNCode(ruling.htsCode.substring(0, 8))
                        : ruling.htsCode}
                    </span>
                  </div>
                  {ruling.issuedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Issued: {new Date(ruling.issuedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <p className="mb-4 last:mb-0 text-sm leading-relaxed">{children}</p>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                ul: ({ children }) => (
                  <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>
                ),
                li: ({ children }) => <li className="text-sm">{children}</li>,
                h1: ({ children }) => (
                  <h1 className="mb-4 text-xl font-semibold">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 text-lg font-semibold">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 text-base font-semibold">{children}</h3>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="my-4 overflow-x-auto rounded bg-muted p-3 text-xs">
                    {children}
                  </pre>
                ),
              }}
            >
              {ruling.body}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

