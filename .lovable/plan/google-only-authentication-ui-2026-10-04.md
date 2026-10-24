# Google-only authentication UI

## Scope
- Preserve the existing Google Identity Services button, credential exchange, Flask endpoint, token session restoration, and role-based redirects.
- Remove email/password login and registration controls, demo credential controls, and all registration links from the frontend.
- Keep `/login` as the single sign-in page with the requested Drainage Watch copy and Google button.
- Retire `/register` safely by redirecting old bookmarks to `/login`; do not change backend routes, users, tables, environment settings, OAuth settings, or unrelated pages.

## Implementation
1. Simplify the frontend auth context to expose Google sign-in, session restoration, role state, and logout only.
2. Simplify the login page to the existing auth card plus the unchanged Google sign-in component.
3. Replace the registration page with a route-level redirect to login.
4. Remove desktop and mobile navigation links to account creation.
5. Update Google-only error copy so it no longer recommends email/password.
6. Search the frontend for remaining email/password entry points, run targeted checks, inspect the current build result, and verify login/redirect behavior in the browser.

## Technical notes
- The existing Flask email/password endpoints and database schema remain untouched.
- Existing JWT restoration and server-provided `citizen`/`admin` roles remain authoritative.
- No OAuth client IDs, hosting settings, CORS settings, or database configuration will change.
