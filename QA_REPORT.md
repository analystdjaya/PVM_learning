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

This report covers the calculation engine and deterministic scenario data. Browser-based visual and interaction checks are recorded separately after application QA.
