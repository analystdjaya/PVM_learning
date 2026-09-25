# QA Report — PVM Learning Lab

- **Status:** PASS
- **Checks passed / failed:** 6219 / 0
- **Property/random scenarios:** 500 (xorshift32 fixed seed 20260925)
- **Maximum absolute reconciliation / total comparison error:** 1.746230e-10
- **Runtime dependencies:** none; calculation engine extracted from the self-contained HTML and evaluated in Node.js

## Coverage

- All eight required Revenue and Gross Profit identities across all eight presets and 500 deterministic randomized Product × Channel cases.
- No Change; Price Only; pure proportional Quantity growth; Product Mix only; Channel Mix only; Cost Shock; Mixed Reality; and Legacy SKU Removed.
- Independent direct accumulation of Revenue and Gross Profit endpoints.
- Stage waterfall sums; both interpretation contrast scenarios; all-SKU versus recalculated Focus-SKU; zero total Period 1 base; zero current channel; new Product × Channel cell; finite-value checks.

## Results

Every mathematical check passed.

## Browser interaction and visual QA

- **Status:** PASS in Microsoft Edge 153.0.4234.48, opening the public GitHub Pages URL.
- **Public smoke test:** HTTP 200 from https://analystdjaya.github.io/PVM_learning/.
- **Interactions:** all eight navigation buttons; all eight presets; Gross Profit Cost Shock; editable quantity; Reset; Analyst Mode; Ctrl+Right; Interpretation scenarios A, B, and D; stakeholder wording response.
- **Responsive:** sampled at 1440px desktop, 1024px tablet, and 390px mobile. No horizontal overflow on checked stages.
- **Runtime:** zero external requests, console errors, or uncaught exceptions. No missing runtime assets.
- **Screenshots:** [Orientation](qa/screenshots/desktop-stage-0.png), [Revenue: 3 factors](qa/screenshots/desktop-stage-2.png), [Gross Profit: full bridge](qa/screenshots/desktop-stage-6.png), [Interpretation Lab](qa/screenshots/desktop-stage-7.png), [mobile Revenue](qa/screenshots/mobile-stage-2.png).
