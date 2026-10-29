/**
 * Google OAuth Client ID for frontend sign-in.
 *
 * The primary source is the `VITE_GOOGLE_CLIENT_ID` environment variable (see
 * `.env`). An OAuth Client ID is a public identifier (it ships in every page
 * that renders Google Sign-In), so a literal fallback is embedded at build
 * time so published bundles still render a working button.
 */
export const GOOGLE_CLIENT_ID =
  (import.meta.env["VITE_GOOGLE_CLIENT_ID"] as string | undefined)?.trim() ||
  "1047843690678-6i7267l8bba1rc75k9begme1ml0a7snc.apps.googleusercontent.com";
