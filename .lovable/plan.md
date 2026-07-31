## Goal

Make the app look like chaos.projectdiscovery.io: clean, light, near-monochrome, with mono uppercase micro-labels and flat bordered panels. Style only — no data, scan, or cron logic changes.

## What the reference actually looks like

- Light canvas (near-white `#fff`), soft gray panel fills, hairline `#e6e6e6` borders, black primary buttons with white text, pill-shaped secondary buttons with a thin border.
- Huge tight-tracked bold hero headline in black, muted gray body copy, centered hero with two pill CTAs.
- Bordered "grid" cards divided by hairlines (WHAT / WHY / HOW) rather than shadowed floating cards.
- Small colored icon tiles (red/green/blue) as the only accent color.
- Tiny uppercase monospace labels (`SOURCES (DNS, TLS, HTTP)`) inside gray pills.
- Black terminal block with monospace green-ish/gray output as the one dark surface.
- Dense, quiet data table with hairline row separators, no zebra striping, no heavy chrome.
- Minimal motion: subtle fades, no bouncy animation.

## Changes

**1. Theme tokens (`src/styles.css`)**
- Make light mode the default and the "real" theme: white background, `oklch` neutrals for card/muted/border matching the reference grays, black `--primary` with white foreground.
- Keep the existing dark palette as the toggle target but flatten it to near-black/neutral gray (drop the heavy green cast; keep a single restrained accent).
- Reduce `--radius` for panels/tables (Chaos uses small radii on cards, full pills on buttons).
- Add tokens for the terminal surface (always-dark block) and the pill-label chip so both themes render it identically.

**2. Shared chrome (`src/components/site/chrome.tsx`)**
- Navbar: wordmark + `BETA` chip, plain text nav links, right-side pill "Get Started"-style CTA, hairline bottom border, no blur/gradient.
- `Stat` cards: bordered grid cells sharing hairlines instead of separate rounded cards; mono uppercase label, large tabular number.
- Footer: quiet single-row hairline footer.
- Soften page-transition motion to short opacity/translate fades.

**3. Landing page (`src/routes/index.tsx`)**
- Centered oversized hero headline + muted subtitle + two pill CTAs (solid black primary, outlined secondary).
- WHAT / WHY / HOW bordered grid with small colored icon tiles.
- Keep the live terminal block, restyled as the black monospace surface with the pill captions beneath the pipeline row.

**4. App pages (`dashboard`, `new`, `stats`, `programs`, `program/$slug`, `domain/$domain`, docs)**
- Apply the same panel/table/button/label vocabulary: hairline-bordered panels, pill buttons, mono uppercase section labels, tabular numerals, muted secondary text.
- Inputs/selects: hairline border, subtle focus ring, mono text for domain fields.

**5. Charts (`src/components/site/charts.tsx`)**
- Monochrome-leaning palette: single accent stroke, faint gridlines, mono tick labels, minimal tooltip chrome — so charts read as part of the same quiet system.

## Technical details

- All colors stay semantic tokens in `src/styles.css` (`@theme inline` + `:root`/`.dark`); no hardcoded `text-white`/`bg-black` in components.
- Theme toggle keeps working; default changes from dark to light (`chaos-theme` default and `themeInitScript` in `src/components/site/theme-toggle.tsx`).
- Fonts stay Figtree + JetBrains Mono (already matching the reference pairing).
- No changes to `chaos.server.ts`, `chaos.functions.ts`, API routes, migrations, or the cron job.
- Verification: Playwright screenshots of `/`, `/dashboard`, `/stats`, `/new` in both light and dark.
