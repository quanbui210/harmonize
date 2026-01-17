"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TermsOfServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TermsOfServiceDialog({ open, onOpenChange }: TermsOfServiceDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Terms of Service</DialogTitle>
          <DialogDescription>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
         

          <div>
            <h3 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              By accessing or using HarmonizeAI, you agree to these Terms of Service. If you do not agree, 
              do not use the service.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">2. Description of Service</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              HarmonizeAI provides AI-assisted tools to help users understand EU import classification, 
              documentation, and labeling requirements based on publicly available regulatory information.
            </p>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-2">
              <p className="text-sm text-destructive font-medium">
                ⚠️ HarmonizeAI does not provide legal advice and does not replace customs authorities or 
                Binding Tariff Information (BTI).
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">3. User Responsibilities</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              You agree to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Provide accurate information</li>
              <li>Use the service for lawful purposes</li>
              <li>Not misuse, reverse-engineer, or attempt to bypass platform safeguards</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">4. No Legal Guarantee</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              All outputs are:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Informational</li>
              <li>Non-binding</li>
              <li>Provided &quot;as is&quot;</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              Final classification and acceptance decisions are made solely by customs authorities.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">5. Intellectual Property</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All platform content, software, and branding belong to HarmonizeAI. Users retain ownership 
              of their uploaded data.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">6. Service Availability</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We strive for reliability but do not guarantee uninterrupted access. Features may change or 
              be discontinued.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">7. Limitation of Liability</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              To the maximum extent permitted by law:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>HarmonizeAI is not liable for indirect, incidental, or consequential damages</li>
              <li>We are not responsible for customs decisions, delays, penalties, or enforcement actions</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">8. Termination</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may suspend or terminate access if these terms are violated. Users may stop using the 
              service at any time.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">9. Governing Law</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              These terms are governed by the laws of Finland / European Union.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">10. Changes to Terms</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update these terms. Continued use constitutes acceptance of the updated terms.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">11. Contact</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For questions about these terms:{" "}
              <a 
                href="mailto:support@harmonizeai.com" 
                className="text-primary hover:underline"
              >
                support@harmonizeai.com
              </a>
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

