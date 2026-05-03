import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  askComplianceQuestionAction,
  deleteChatSessionAction,
  getChatSessionAction,
  listChatSessionsAction,
} from "@/server/actions/compliance-chat";
import { handleApiError, requireApiAuth } from "@/lib/api/mobile-auth";

const askQuestionSchema = z.object({
  query: z.string().min(1),
  sessionId: z.string().cuid().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (sessionId) {
      const session = await getChatSessionAction({
        sessionId,
        organizationId: membership.organizationId,
        userId: user.id,
      });

      return NextResponse.json({ session });
    }

    const limit = Number.parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);
    const sessions = await listChatSessionsAction({
      organizationId: membership.organizationId,
      userId: user.id,
      limit: Number.isFinite(limit) ? limit : 20,
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const body = await request.json();
    const payload = askQuestionSchema.parse(body);

    const result = await askComplianceQuestionAction({
      query: payload.query,
      sessionId: payload.sessionId,
      organizationId: membership.organizationId,
      userId: user.id,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, membership } = await requireApiAuth(request);
    const sessionId = request.nextUrl.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 },
      );
    }

    const result = await deleteChatSessionAction({
      sessionId,
      organizationId: membership.organizationId,
      userId: user.id,
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
