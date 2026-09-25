# PVM Learning Lab — handoff

## Calculation definitions

The sample contains 3 channels × 4 products. For every Product × Channel cell, Period 1 and Period 2 hold quantity `Q`, selling price `P`, and cost `C`. Revenue is `Σ(P × Q)`. Gross Profit is `Σ((P − C) × Q)`. Period 1 unit gross margin is `M₁ = P₁ − C₁`.

The calculation engine is embedded in `index.html` and exposed as `window.PVM_LAB_CORE` for browser QA. It calculates totals directly from cell economics and applies the following formulas:

- Price: `Σ((P₂ − P₁) × Q₂)`.
- Volume + Mix: Revenue `Σ((Q₂ − Q₁) × P₁)`; Gross Profit `Σ((Q₂ − Q₁) × M₁)`.
- Quantity: `(TQ₂ − TQ₁) × Σ(W₁ᵢⱼ × P₁ᵢⱼ)` for Revenue, using `M₁` for Gross Profit.
- Total Mix: `Σ((Q₂ᵢⱼ − W₁ᵢⱼ × TQ₂) × P₁ᵢⱼ)` for Revenue, using `M₁` for Gross Profit.
- Channel Mix: `ΣⱼΣᵢ(TQ₂ × (S₂ⱼ − S₁ⱼ) × W₁(i|j) × baseline economics)`.
- Product Mix: `ΣⱼΣᵢ(TQ₂ⱼ × (W₂(i|j) − W₁(i|j)) × baseline economics)`.
- Cost: `−Σ((C₂ − C₁) × Q₂)`; a cost increase is negative.

## Attribution order and invariants

The detailed attribution always changes channel share first, holding Period 1 product shares within each channel, then changes product composition at current channel volume. The channel/product interaction is assigned to Product Mix. Total Mix is invariant to that split; the individual Channel Mix and Product Mix values depend on the chosen order.

Reconciliation invariants:

1. Revenue change = Price + Volume + Mix.
2. Volume + Mix = Quantity + Total Mix.
3. Total Mix = Channel Mix + Product Mix.
4. Revenue change = Price + Quantity + Channel Mix + Product Mix.
5. Gross Profit change = Price + Volume + Mix + Cost.
6. Gross Profit Volume + Mix = Quantity + Total Mix.
7. Gross Profit Total Mix = Channel Mix + Product Mix.
8. Gross Profit change = Price + Quantity + Channel Mix + Product Mix + Cost.

## Scenario semantics

- **No Change:** copies each Period 1 value into Period 2; all impacts are zero.
- **Price Only:** changes price while quantity and cost remain at Period 1.
- **Pure Quantity Growth:** scales all Period 1 quantities by 15%; shares are preserved.
- **Product Mix Shift:** holds total quantity and channel totals fixed, moving Direct volume from Core to Pro.
- **Channel Mix Shift:** holds total quantity and each channel’s internal product shares fixed while reallocating units across channels.
- **Cost Shock:** adds $8 unit cost while revenue inputs stay fixed.
- **Mixed Reality:** applies the illustrative Period 2 changes across prices, costs, quantity, and composition.
- **Legacy SKU Removed:** applies the mixed case and sets Period 2 Legacy quantities to zero.

The Interpretation Lab uses separate deterministic examples to guarantee the requested contrast between positive mix/lower Gross Profit and negative mix/higher Gross Profit. Focus-SKU excludes Legacy from both periods, then recalculates totals and shares. Focus-SKU analysis alone does not establish that removing an item created value.

## Edge-case policy

The teaching dataset avoids ambiguous zero-denominator cases. If Period 1 total quantity is zero, Quantity and Total Mix are marked N/A. If a channel has no comparable quantity in either period, the detailed channel/product split is marked N/A. New Product × Channel cells without a Period 1 sale are flagged and the detailed split is not presented as an ordinary zero-share comparison. Discontinued items with a valid Period 1 share remain visible and are flagged. The UI never displays `NaN` or `Infinity`.

Real analyses should separately review new and discontinued products, channels without comparable prior-period mix, free goods, returns, and credit notes. Adding channel detail can change the attribution among Price, Cost, and Mix when economics differ by channel; the underlying business result stays the same.

## Design principles

The interface uses a warm paper background, dark ink, restrained positive/negative colors, Inter-first local system sans fallbacks, strong type hierarchy, persistent learning navigation, and a cumulative SVG impact waterfall. Exact period totals sit beside a zero-start impact bridge so the scale remains legible without hiding the full business values. Signs, labels, and placement carry meaning in addition to color. Motion respects `prefers-reduced-motion`; controls use native semantic buttons, details, selects, labels, and visible focus states. All CSS and JavaScript are inline in `index.html`; no web font is downloaded.

The Figma foundation specimen and the visual review boundary for the free plan are recorded in [FIGMA_REVIEW.md](FIGMA_REVIEW.md). Browser and Canva review findings are in [CANVA_REVIEW.md](CANVA_REVIEW.md).

## Updating the illustrative dataset

Edit `P1`, `ECONOMICS`, `P2`, `PRICE_DELTA`, and `COST_DELTA` in the `pvm-engine` script block in `index.html`. Keep Product and Channel ordering consistent across the arrays. Then update the scenario-specific checks only if preset semantics change. Run `node qa/run-qa.mjs` and review all stage explanations against the formulas before publishing.

## QA and publishing

Run the QA script from the project directory with `node qa/run-qa.mjs`. It rewrites `QA_REPORT.md` with the test counts and maximum reconciliation error. The site has no build step: push a commit to `main`, and the official GitHub Pages workflow publishes the root-level static files.
