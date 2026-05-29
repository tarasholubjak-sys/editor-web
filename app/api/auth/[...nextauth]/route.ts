/**
 * NextAuth API роути — обробляють /api/auth/signin, /api/auth/callback/google, etc.
 */
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
