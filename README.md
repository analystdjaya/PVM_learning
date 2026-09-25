# PVM Learning Lab

An interactive, illustrative learning lab for Revenue and Gross Profit Price-Volume-Mix analysis. It takes analysts from a combined Volume + Mix bridge through pure Quantity, Total Mix, Channel Mix, Product Mix, and Cost, then practices responsible interpretation.

## What it includes

- Eight learning stages with one shared 3-channel × 4-product dataset.
- Custom SVG impact waterfalls, live simulation presets, and an editable Product × Channel table.
- Analyst Mode with formulas, reconciliation, the Channel-first attribution rule, and data caveats.
- A stakeholder interpretation lab with All-SKU and Focus-SKU comparison.
- No external runtime libraries, fonts, APIs, or network requests.

The visual foundation and review findings are documented in [FIGMA_REVIEW.md](FIGMA_REVIEW.md), [CANVA_REVIEW.md](CANVA_REVIEW.md), the [Figma file](https://www.figma.com/design/1NY05JxCMhSvaeRCOwb2kL), and the [Canva review copy](https://www.canva.com/d/6IPkLU4fYNawy32).

Revenue mix uses Period 1 selling price. Gross Profit mix uses Period 1 unit gross margin. The detailed split applies Channel Mix first, followed by Product Mix within Channel; that order determines the individual mix attribution.

All data are fictional and for training only; they do not represent any company or commercial result.

## Open and verify

Open `index.html` directly in a browser, or use the live [GitHub Pages learning lab](https://analystdjaya.github.io/PVM_learning/).

Run the mathematical verification from this directory:

```powershell
node qa/run-qa.mjs
node qa/run-browser-qa.mjs
```

The first command checks deterministic presets, eight reconciliation identities, edge cases, an independent direct-total path, and seeded randomized scenarios. The second opens the app directly in Microsoft Edge, tests the interactions and responsive layouts, captures representative screenshots, and adds its results to `QA_REPORT.md`.

## Publish updates

Edit the project, run the QA command, then commit and push to `main`. GitHub Pages deploys the repository root automatically through the workflow in `.github/workflows/pages.yml`.
