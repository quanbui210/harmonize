"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

interface DisclaimerModalProps {
  feature: "PRODUCT_LABEL" | "CLASSIFICATION" | "IMPORT_GUIDANCE";
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const DISCLAIMER_VERSION = "1.0.0";

const DISCLAIMER_TEXT = {
  PRODUCT_LABEL: {
    title: "Product Label Disclaimer",
    content: `This application provides AI-generated information regarding product labeling requirements and regulatory compliance. All information is for informational purposes only and does not constitute legal, tax, or professional customs advice.

The Service utilizes Large Language Models (LLMs) and Artificial Intelligence. While we strive for accuracy, AI can occasionally generate incorrect or outdated information. The Service should be used as a supplementary tool and not as the sole basis for commercial decisions.

Under EU and Finnish law, the legal responsibility for correct labeling lies solely with the Economic Operator (the Importer or Seller). Users are strongly encouraged to verify all generated labels with official authorities (e.g., Tulli, Ruokavirasto, or Tukes).

Use of this Service does not guarantee that your goods will pass customs or health inspections. The final decision rests entirely with the relevant government authorities.`,
  },
  CLASSIFICATION: {
    title: "Classification Disclaimer",
    content: `This application provides AI-generated product classification information (HS/CN codes). All information is for informational purposes only and does not constitute legal or professional customs advice.

The Service utilizes Large Language Models (LLMs). While we strive for accuracy, AI can occasionally generate incorrect classifications. Users are strongly encouraged to verify all codes with official authorities (e.g., Tulli) or apply for Binding Tariff Information (BTI).

The legal responsibility for correct classification lies solely with the importer.`,
  },
  IMPORT_GUIDANCE: {
    title: "Import Guidance Disclaimer",
    content: `This application provides AI-generated import guidance and regulatory information. All information is for informational purposes only and does not constitute legal or professional advice.

Users are strongly encouraged to verify all guidance with official authorities. The legal responsibility for compliance lies solely with the importer.`,
  },
};

const OFFICIAL_LINKS = [
  { name: "Ruokavirasto (Food Authority)", url: "https://www.ruokavirasto.fi" },
  { name: "Tukes (Product Safety)", url: "https://www.tukes.fi" },
  { name: "Tulli (Customs)", url: "https://tulli.fi" },
  { name: "EU TARIC Database", url: "https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp" },
];

export function DisclaimerModal({ feature, open, onAccept, onDecline }: DisclaimerModalProps) {
  const [accepted, setAccepted] = useState(false);
  const disclaimer = DISCLAIMER_TEXT[feature];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDecline()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{disclaimer.title}</DialogTitle>
          <DialogDescription>
            Please read and accept the disclaimer to continue
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {disclaimer.content}
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Official Sources:</p>
            <ul className="space-y-1">
              {OFFICIAL_LINKS.map((link) => (
                <li key={link.url}>
                  <Link
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {link.name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-2 pt-2">
            <Checkbox
              id="accept"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
            />
            <label
              htmlFor="accept"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I understand and accept the disclaimer. I acknowledge that I am solely responsible for verifying all information with official authorities.
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onDecline}>
            Decline
          </Button>
          <Button onClick={onAccept} disabled={!accepted}>
            Accept and Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

