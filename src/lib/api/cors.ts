import { NextRequest, NextResponse } from "next/server";

const allowedOriginPatterns = [
  /^http:\/\/localhost:\d+$/i,
  /^https:\/\/localhost:\d+$/i,
  /^http:\/\/127\.0\.0\.1:\d+$/i,
  /^https:\/\/127\.0\.0\.1:\d+$/i,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/i,
  /^https:\/\/192\.168\.\d+\.\d+:\d+$/i,
];

export function getCorsOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  return allowedOriginPatterns.some((pattern) => pattern.test(origin))
    ? origin
    : null;
}

export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
) {
  const origin = getCorsOrigin(request);
  if (!origin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Organization-Id",
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Vary", "Origin");

  return response;
}

export function jsonWithCors(
  request: NextRequest,
  body: unknown,
  init?: ResponseInit,
) {
  return applyCorsHeaders(request, NextResponse.json(body, init));
}

export function handleCorsPreflight(request: NextRequest) {
  return applyCorsHeaders(request, new NextResponse(null, { status: 204 }));
}
