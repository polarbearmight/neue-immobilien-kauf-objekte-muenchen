import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = [
  "/dashboard",
  "/deals",
  "/watchlist",
  "/brand-new",
  "/price-drops",
  "/clusters",
  "/off-market",
  "/districts",
  "/geo",
  "/map",
  "/sources",
  "/settings",
  "/district-debug",
  "/source-debug",
  "/duplicate-debug",
  "/geo-debug",
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAuthed = req.cookies.get("mdf_auth")?.value === "1";

  if (isProtected && !isAuthed) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/deals/:path*", "/watchlist/:path*", "/brand-new/:path*", "/price-drops/:path*", "/clusters/:path*", "/off-market/:path*", "/districts/:path*", "/geo/:path*", "/map/:path*", "/sources/:path*", "/settings/:path*", "/district-debug/:path*", "/source-debug/:path*", "/duplicate-debug/:path*", "/geo-debug/:path*"],
};
