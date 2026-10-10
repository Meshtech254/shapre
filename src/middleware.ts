import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Signed output capabilities are verified in their API; viewers need no account refresh.
  if (
    request.nextUrl.pathname.startsWith("/studio/output/") ||
    request.nextUrl.pathname.startsWith("/api/v1/output/")
  )
    return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const protectedPage =
    /^\/(dashboard|personas|demo-personas|studio|settings|billing|admin)(\/|$)/.test(
      request.nextUrl.pathname,
    ) && !request.nextUrl.pathname.startsWith("/studio/output/");
  if (!url || !key)
    return protectedPage
      ? NextResponse.redirect(new URL("/login?setup=required", request.url))
      : response;
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await db.auth.getUser();
  if (protectedPage && !user) {
    const target = new URL("/login", request.url);
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)",
  ],
};
