import createIntlProxy from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intlProxy = createIntlProxy(routing);

export function proxy(request: NextRequest) {
  return intlProxy(request);
}

export const config = {
  matcher: "/((?!api|admin|_next|_vercel|.*\\..*).*)",
};
