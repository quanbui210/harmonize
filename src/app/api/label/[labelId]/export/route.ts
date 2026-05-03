import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handleApiError } from "@/lib/api/mobile-auth";
import { authenticateRequest } from "@/lib/api/request-auth";
import type { EnhancedLabelData } from "@/lib/labeling/label-generator-enhanced";
import { generateLabelHTML } from "./label-html-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ labelId: string }> }
) {
  try {
    const { membership } = await authenticateRequest(request);

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

    const labelData = label.labelData as any as EnhancedLabelData & {
      productCategory?: string;
    };
    const productCategory = (labelData?.productCategory as string | undefined) || "food";

    const htmlContent = generateLabelHTML(labelData, productCategory);
    
    const printReadyHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Label Export</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
      background: #f3f4f6;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .no-print {
        display: none;
      }
    }
    .label-container {
      background: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    @media print {
      .label-container {
        box-shadow: none;
      }
    }
  </style>
  <script>
    window.onload = function() {
      // Auto-print after a short delay
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</head>
<body>
  <div class="label-container">
    ${htmlContent}
  </div>
</body>
</html>
    `;

    return new NextResponse(printReadyHTML, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="label-${labelId}.html"`,
      },
    });
  } catch (error) {
    console.error("Label export error:", error);
    return handleApiError(error);
  }
}
