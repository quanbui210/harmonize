import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { getPrimaryMembership } from "@/server/queries/organizations";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { generatePDFFromHTMLCustomSize } from "@/lib/pdf/generator";
import { generateLabelHTML } from "../export/label-html-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const user = await requireAuthenticatedUser();
    const membership = await getPrimaryMembership(user.id);
    if (!membership) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { labelId } = await params;
    const label = await prisma.label.findFirst({
      where: {
        id: labelId,
        organizationId: membership.organizationId,
      },
    });

    if (!label) {
      return NextResponse.json({ error: "Label not found" }, { status: 404 });
    }

    const labelData = label.labelData as any as EnhancedLabelData;
    const productCategory = labelData?.productCategory || "food";

    // Generate HTML content
    const htmlContent = generateLabelHTML(labelData, productCategory);
    
    // Wrap in full HTML document
    const fullHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Label</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: white;
    }
    @page {
      margin: 0;
      size: ${labelData.labelDimensions?.width || 100}mm ${labelData.labelDimensions?.height || 150}mm;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
    `;

    // Get label dimensions
    const width = labelData.labelDimensions?.width || 100;
    const height = labelData.labelDimensions?.height || 150;

    // Generate PDF
    const pdfBuffer = await generatePDFFromHTMLCustomSize(fullHTML, width, height);

    // Helper to get product name for filename
    function getProductNameString(productName: any): string {
      if (!productName) return "Product";
      if (typeof productName === "string") return productName;
      if (typeof productName !== "object") return "Product";
      if (productName.translations && typeof productName.translations === "object") {
        const trans = productName.translations;
        if (typeof trans.fi === "string") return trans.fi;
        if (typeof trans.sv === "string") return trans.sv;
        if (typeof productName.original === "string") return productName.original;
      }
      if (typeof productName.original === "string") return productName.original;
      return "Product";
    }

    const productName = getProductNameString(labelData.productName);
    // Sanitize filename: remove special characters and replace spaces
    const sanitizedProductName = productName
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "") // Remove non-ASCII and special chars
      .slice(0, 50); // Limit length
    const filename = `${sanitizedProductName}_label.pdf`;
    const filenameEncoded = encodeURIComponent(filename);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${filenameEncoded}`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Label PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
