/**
 * NextAuth middleware — захищає весь editor-web.
 *
 * Дозволяє без авторизації тільки /api/auth/* і /auth/signin (сама сторінка логіну).
 * Все інше → редірект на /auth/signin.
 */

import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const path = nextUrl.pathname;

  // Публічні шляхи: NextAuth API + сторінка логіну
  const isPublic =
    path.startsWith("/api/auth") ||
    path.startsWith("/auth/") ||
    path === "/favicon.ico" ||
    path.startsWith("/_next/") ||
    path.endsWith(".png") ||
    path.endsWith(".svg") ||
    path.endsWith(".ico");

  if (isPublic) return;

  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", nextUrl.origin);
    // зберігаємо куди юзер хотів зайти, щоб після логіну повернути
    signInUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return Response.redirect(signInUrl);
  }
});

export const config = {
  // _next, статика виключені автоматично через matcher
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
