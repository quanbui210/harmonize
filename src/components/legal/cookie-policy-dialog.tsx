"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CookiePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CookiePolicyDialog({ open, onOpenChange }: CookiePolicyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Cookie Policy</DialogTitle>
          <DialogDescription>
            Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">What Are Cookies?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cookies are small text files that are placed on your device when you visit our website. 
              They help us provide you with a better experience by remembering your preferences and 
              enabling certain features of our service.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">How We Use Cookies</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              HarmonizeAI uses cookies for the following purposes:
            </p>
            
            <div className="space-y-4">
              <div className="border-l-4 border-primary/20 pl-4">
                <h4 className="font-semibold text-sm mb-1">Essential Cookies</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  These cookies are necessary for the website to function properly. They enable core 
                  functionality such as authentication, security, and session management. Without 
                  these cookies, services you have requested cannot be provided.
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>Authentication and session management (Supabase)</li>
                  <li>Security and fraud prevention</li>
                  <li>Load balancing and performance</li>
                </ul>
              </div>

              <div className="border-l-4 border-primary/20 pl-4">
                <h4 className="font-semibold text-sm mb-1">Functional Cookies</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  These cookies allow the website to remember choices you make (such as your language 
                  preference or region) and provide enhanced, personalized features.
                </p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                  <li>User preferences and settings</li>
                  <li>Organization selection</li>
                  <li>UI state and navigation</li>
                </ul>
              </div>

              <div className="border-l-4 border-primary/20 pl-4">
                <h4 className="font-semibold text-sm mb-1">Analytics Cookies (Optional)</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  These cookies help us understand how visitors interact with our website by collecting 
                  and reporting information anonymously. This helps us improve our service and user experience.
                </p>
                <p className="text-sm text-muted-foreground mt-2 italic">
                  Currently, we do not use third-party analytics cookies. If we implement analytics 
                  in the future, we will update this policy and provide you with the option to opt-out.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Third-Party Cookies</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">
              We use the following third-party services that may set cookies:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
              <li>
                <strong>Supabase:</strong> Authentication and database services. These cookies are 
                essential for user authentication and session management.
              </li>
              <li>
                <strong>Google OAuth:</strong> When you sign in with Google, Google may set cookies 
                for authentication purposes. These are governed by Google&apos;s privacy policy.
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Managing Your Cookie Preferences</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              You can control and manage cookies in several ways:
            </p>
            <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside mb-4">
              <li>
                <strong>Browser Settings:</strong> Most browsers allow you to refuse or accept cookies, 
                and to delete cookies that have already been set. You can usually find these settings 
                in the &quot;Privacy&quot; or &quot;Security&quot; section of your browser settings.
              </li>
              <li>
                <strong>Essential Cookies:</strong> Please note that disabling essential cookies may 
                affect the functionality of our website and prevent you from using certain features, 
                including authentication and access to your account.
              </li>
              <li>
                <strong>Third-Party Cookies:</strong> You can manage third-party cookies through your 
                browser settings or by visiting the respective third-party provider&apos;s website.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              For more information about managing cookies, visit{" "}
              <a 
                href="https://www.allaboutcookies.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                www.allaboutcookies.org
              </a>
              .
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">EU Cookie Law Compliance</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              In accordance with the EU ePrivacy Directive and GDPR, we inform you about the use of 
              cookies on our website. Essential cookies are necessary for the website to function and 
              do not require your consent. For any optional cookies, we will seek your consent before 
              they are set.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Updates to This Policy</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in our practices 
              or for other operational, legal, or regulatory reasons. The &quot;Last updated&quot; date 
              at the top of this policy indicates when it was last revised.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Contact Us</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you have any questions about our use of cookies or this Cookie Policy, please contact 
              us through our support channels or at the contact information provided in our Terms of Service.
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


