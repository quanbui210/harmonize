"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PrivacyPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyPolicyDialog({ open, onOpenChange }: PrivacyPolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Privacy Policy</DialogTitle>
          <DialogDescription>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* <div className="bg-muted/50 border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground italic">
              ⚠️ <strong>Important note (transparent):</strong> This is a startup-grade legal template, 
              suitable for launch and early customers. Before enterprise deals, you should have a lawyer 
              review it. Nothing here overpromises legal guarantees.
            </p>
          </div> */}

          <div>
            <h3 className="text-lg font-semibold mb-2">1. Introduction</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              HarmonizeAI (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides an online platform that assists users in 
              understanding EU import classification and compliance requirements. We respect your privacy and 
              are committed to protecting personal data in accordance with the EU General Data Protection 
              Regulation (GDPR).
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">2. Data Controller</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              HarmonizeAI
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related requests, please contact us at{" "}
              <a 
                href="mailto:privacy@harmonizeai.com" 
                className="text-primary hover:underline"
              >
                privacy@harmonizeai.com
              </a>
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">3. Personal Data We Collect</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              We may collect the following categories of data:
            </p>
            
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">a) Account Information</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Company name (if provided)</li>
                  <li>Login credentials (hashed)</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-1">b) Usage & Technical Data</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
                  <li>IP address</li>
                  <li>Browser type</li>
                  <li>Device information</li>
                  <li>Pages accessed and actions taken</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-1">c) Product Data (User-Provided)</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
                  <li>Product descriptions</li>
                  <li>Ingredient lists</li>
                  <li>Uploaded images or documents</li>
                </ul>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mt-3">
              ⚠️ We do not require sensitive personal data and ask users not to submit such data.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">4. Purpose of Processing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              We process data to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Provide and operate the HarmonizeAI platform</li>
              <li>Generate compliance analyses and reports</li>
              <li>Improve system accuracy and reliability</li>
              <li>Communicate service-related messages</li>
              <li>Comply with legal obligations</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">5. Legal Basis (GDPR)</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Processing is based on:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Performance of a contract (Article 6(1)(b))</li>
              <li>Legitimate interests (Article 6(1)(f))</li>
              <li>Legal obligations (Article 6(1)(c))</li>
              <li>User consent where required (Article 6(1)(a))</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">6. Data Sharing</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              We do not sell personal data.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              We may share data with:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Cloud hosting providers (EU or GDPR-compliant)</li>
              <li>Analytics providers (privacy-respecting)</li>
              <li>Legal authorities if required by law</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">7. Data Retention</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We retain personal data only as long as necessary to provide the service or comply with 
              legal obligations. Users may request deletion at any time.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">8. User Rights</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              Under GDPR, you have the right to:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Access your data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion</li>
              <li>Restrict or object to processing</li>
              <li>Data portability</li>
              <li>Lodge a complaint with a supervisory authority</li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">9. Security</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We implement technical and organizational measures to protect data, including encryption, 
              access controls, and secure hosting.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">10. Cookies</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We use cookies for essential site functionality and analytics (where consented). 
              See our Cookie Policy for details.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">11. Changes</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this policy periodically. Material changes will be communicated via the platform.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">12. Contact</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For privacy-related requests:{" "}
              <a 
                href="mailto:privacy@harmonizeai.com" 
                className="text-primary hover:underline"
              >
                privacy@harmonizeai.com
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


