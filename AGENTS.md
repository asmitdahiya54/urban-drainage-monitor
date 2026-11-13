- Google sign-in: frontend gets a Google ID token (VITE_GOOGLE_CLIENT_ID), Flask /api/auth/google verifies it (GOOGLE_CLIENT_ID) and issues the normal app JWT - why: keeps one auth system and existing role checks.

- Authentication entry: the public frontend offers Google sign-in only while legacy Flask account endpoints and database records remain intact - why: simplify access without disrupting existing users or roles.

- Same-origin API proxy returns empty 200 payloads only for optional public map/hotspot/risk reads when Flask is unreachable - why: public visual overlays must degrade without blanking the app before deployment.
