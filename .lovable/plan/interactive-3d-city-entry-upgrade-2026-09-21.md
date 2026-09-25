# Interactive 3D City Entry Upgrade

## Goal
Replace the first impression of `/` with a polished, interactive digital-twin city while preserving every existing route, API call, authentication flow, map, report, analytics, admin feature, and backend service.

## Experience
- Show a short dark initialization sequence, then progressively reveal a procedural holographic city with illuminated buildings, roads, drainage lines, particles, fog, and restrained glow.
- Support desktop rotate/zoom/pan and mobile drag/pinch, plus reset, layer visibility, keyboard-accessible actions, reduced-motion behavior, and a WebGL fallback.
- Render integrated red, amber, and green risk beacons with hover summaries, click-to-focus camera movement, and a selected-area panel linking to the existing `/map` and `/report` routes.
- Provide a clear Skip/Enter Platform action. Entry triggers a cinematic camera push and interface fade before revealing the homepage.
- Remember `hasSeenCityIntro` locally so returning visitors enter the platform quickly, while a new `/city` route and “3D City” navigation item keep the experience available.

## Data architecture
- Add a small city-domain adapter that converts the existing privacy-safe public map/hotspot responses into normalized 3D risk zones.
- Use current backend data when available; use the three requested Sector 12/8/21 demonstration zones only as an explicitly structured fallback.
- Keep the adapter independent from Three.js so the 3D city and existing 2D map can later share geographic/report data without replacing either implementation.
- Populate homepage statistics from the existing public map summary when reachable; show neutral unavailable states rather than invented live totals.

## Visual system
- Extend semantic design tokens with deep navy, cyan infrastructure, glass surfaces, and risk-state colors.
- Redesign the post-entry homepage around “Cleaner Cities. Smarter Drainage.” with existing report and map destinations, live summary cards, concise community workflow, and SDG context.
- Update shared navigation styling and add “3D City” without changing role-aware links or authentication behavior.
- Keep the uploaded image as visual reference only; it will not be embedded.

## Technical implementation
- Add React Three Fiber, Three.js, Drei, lightweight post-processing, and motion support compatible with React 19.
- Split the city into focused components: canvas/scene, instanced procedural buildings, drainage network, risk markers, camera controller, HUD, data adapter, intro controller, and fallback.
- Keep browser-only 3D imports behind lazy loading and client-only rendering; cap pixel ratio, geometry, particles, lights, and post-processing for ordinary laptops and mobile devices.
- Use deterministic geometry to avoid hydration mismatch and maintain stable visuals.
- Add unique metadata for `/city` and preserve/update the existing homepage metadata.

## Validation
- Verify initial loading/reveal, orbit controls, zoom, reset, hover, selection, camera focus, links, skip/enter transition, remembered preference, reopen flow, WebGL fallback, and reduced motion.
- Test desktop and mobile layouts with browser screenshots, confirm the scene is visible and framed, compare states to prove interaction/motion, and check console/network errors.
- Run the existing frontend type check, lint, production build, and the complete backend regression suite to confirm no Steps 1–13 behavior regressed.
