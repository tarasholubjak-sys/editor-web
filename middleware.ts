/**
 * HTTP Basic Auth на весь editor-web (UI + API).
 *
 * Захищає від випадкових користувачів у VPN-мережі компанії —
 * хтось може зайти на editor.selfy.com.ua і пропалити токени.
 *
 * ENV:
 *   EDITOR_AUTH_USER     — логін (default: selfy)
 *   EDITOR_AUTH_PASSWORD — пароль. Якщо не задано — middleware вимкнено (dev).
 */

import { NextRequest, NextResponse } from "next/server";

export const config = {
  // Захищаємо все крім _next, статики і favicon
  matcher: ["/((?!_next|favicon|robots.txt|.*\\..*).*)"],
};

export function middleware(req: NextRequest) {
  const expectedPassword = process.env.EDITOR_AUTH_PASSWORD;

  // Якщо пароль не заданий — пропускаємо (dev-режим без захисту)
  if (!expectedPassword) {
    return NextResponse.next();
  }

  const expectedUser = process.env.EDITOR_AUTH_USER || "selfy";
  const authHeader = req.headers.get("authorization") || "";

  if (authHeader.toLowerCase().startsWith("basic ")) {
    try {
      const raw = authHeader.slice(6).trim();
      const decoded = Buffer.from(raw, "base64").toString("utf-8");
      const sepIdx = decoded.indexOf(":");
      if (sepIdx > -1) {
        const user = decoded.slice(0, sepIdx);
        const pass = decoded.slice(sepIdx + 1);
        if (user === expectedUser && pass === expectedPassword) {
          return NextResponse.next();
        }
      }
    } catch {
      /* fallthrough — 401 */
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Selfy Editor", charset="UTF-8"',
    },
  });
}
