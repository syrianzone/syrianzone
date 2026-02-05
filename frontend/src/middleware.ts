import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { aj, ajVoting } from "@/lib/arcjet";

const VOTING_PATHS = ["/api/polls/*/vote", "/api/submit"];

function isVotingPath(pathname: string): boolean {
  return VOTING_PATHS.some((pattern) => {
    const regex = new RegExp("^" + pattern.replace(/\*/g, "[^/]+") + "$");
    return regex.test(pathname);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protector = isVotingPath(pathname) ? ajVoting : aj;
  const decision = await protector.protect(request, { requested: 1 });

  if (decision.isDenied()) {
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down.", reason: decision.reason },
        { status: 429 }
      );
    }

    if (decision.reason.isBot()) {
      return NextResponse.json(
        { error: "Automated requests not allowed", reason: decision.reason },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Forbidden", reason: decision.reason },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
