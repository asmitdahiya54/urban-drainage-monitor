<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Google sign-in: frontend gets a Google ID token (VITE_GOOGLE_CLIENT_ID), Flask /api/auth/google verifies it (GOOGLE_CLIENT_ID) and issues the normal app JWT — why: keeps one auth system and existing role checks.
- Same-origin API proxy returns empty 200 payloads only for optional public map/hotspot/risk reads when Flask is unreachable — why: public visual overlays must degrade without blanking the app before deployment.
