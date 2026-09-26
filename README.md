# PVM Learning Lab

A visual-first learning tool for understanding Revenue and Gross Profit Price–Volume–Mix decomposition.

Live site: https://analystdjaya.github.io/PVM_learning/

## Learning flow

1. Revenue — Price vs Volume + Mix
2. Revenue — Price, Quantity, Total Mix
3. Revenue — Price, Quantity, Channel Mix, Product Mix
4. Gross Profit — Price, Volume + Mix, Cost
5. Gross Profit — Price, Quantity, Total Mix, Cost
6. Gross Profit — Price, Quantity, Channel Mix, Product Mix, Cost
7. Interpretation Lab

The application uses one illustrative 3-channel × 4-SKU dataset throughout.

## Method

The detailed mix decomposition uses **Channel first → Product within Channel**. Quantity and Mix effects use Period-1 economics as the baseline so Price and Cost are isolated cleanly.

The browser runs 64 reconciliation checks across controlled scenarios. The header shows the verification status.

## Files

- `index.html` — learning flow
- `styles.css` — visual system
- `app.js` — scenarios, calculations, chart rendering, checks
- `.github/workflows/pages.yml` — GitHub Pages deployment

All business data in this repository are illustrative.
