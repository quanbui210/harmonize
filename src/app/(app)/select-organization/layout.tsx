import type { ReactNode } from "react";

type LayoutProps = {
  children: ReactNode;
};

// Separate layout for select-organization page (no AppShell)
export default function SelectOrganizationLayout({ children }: LayoutProps) {
  return <>{children}</>;
}

