## Goal

Level up the existing motion (scroll reveals, hover lift, live dot) into a cohesive, high-end animation system — the kind of polish you'd see on a top product site — without slowing down the heavy data pages.

## What gets added

**1. Global motion language**
- Shared easing + duration tokens (one "signature" spring and one snappy ease) in `src/styles.css`, used by every animation so the site feels like one product.
- Route transitions: fade + slight rise on route change via an animated wrapper in `src/routes/__root.tsx`, so navigating between Home / Dashboard / Programs feels continuous.
- All new motion stays inside the existing `prefers-reduced-motion` guard.

**2. Hero (home page)**
- Animated ambient background: slow-drifting grid/gradient mesh with a subtle scanline, pure CSS so it costs nothing.
- Headline reveal word-by-word with a mask-up effect, followed by staggered subtext and buttons.
- Terminal mock gets a typewriter effect that types the chaos command and streams a few subdomain lines, then loops on a long interval.

**3. Numbers that feel alive**
- Count-up animation for all stat cards (total domains, subdomains, new this hour/day) — animates on first view, and smoothly tweens to the new value when live data refreshes instead of snapping.
- New-subdomain badges get a brief highlight flash when a value increases during a live refetch.

**4. Data surfaces**
- Recently-added subdomains feed: new rows slide in from the top with a highlight sweep, existing rows shift down using layout animation (`AnimatePresence` + `layout`).
- Tables (dashboard, domain detail, programs): staggered row entrance capped to the first ~20 rows so 6k-row lists stay fast; row hover gets an accent left-edge and background wipe.
- Charts: draw-on animation for lines/areas, animated tooltip, and a shimmer skeleton while loading instead of a blank box.

**5. Micro-interactions**
- Buttons: press-scale, hover glow on primary, and a spinner→checkmark morph for "Run scan" so scan feedback is visual.
- Copy buttons: icon morphs to a check with a ripple.
- Nav: animated underline that slides between active links (shared layout id), plus mobile menu spring.
- Cards: pointer-tracked highlight on hover (subtle spotlight following the cursor).
- Skeleton shimmer replaces plain "Loading…" text everywhere.
- Scroll progress bar under the sticky header.

**6. Performance guardrails**
- Only `transform`/`opacity` animated; no layout-thrashing properties.
- Stagger caps and `viewport={{ once: true }}` on reveals.
- No motion added to the 6k+ row virtualized/paginated body beyond the first page.

## Technical notes

- Uses the already-installed `framer-motion` plus CSS keyframes in `src/styles.css`; no new dependencies.
- New small components: `src/components/site/motion.tsx` (variants, `Reveal`, `Stagger`, `CountUp`, `Typewriter`, `Spotlight`, `ScrollProgress`), reused across routes rather than duplicating motion code per page.
- Touched routes: `__root.tsx`, `index.tsx`, `dashboard.tsx`, `domain.$domain.tsx`, `programs.tsx`, `program.$slug.tsx`, `stats.tsx`, plus `chrome.tsx` and `charts.tsx`.
- Purely presentational — no changes to the scanner, cron schedule, database, or server functions.
- Verified with Playwright screenshots at desktop and mobile widths after implementation.
