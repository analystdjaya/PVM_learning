# PVM Learning Lab

A visual-first learning tool for understanding Revenue and Gross Profit Price–Volume–Mix decomposition.

Live site: https://analystdjaya.github.io/PVM_learning/

## Core learning rule

The **Step 6 Mixed Reality bridge is the source of truth**. One master Product × Channel dataset drives every Revenue and Gross Profit page.

Earlier steps never create a different example. They only combine the same detailed drivers:

- Volume + Mix = Quantity + Total Mix
- Total Mix = Channel Mix + Product Mix
- Gross Profit adds Cost

The driver-focus controls also keep the same Period 1 and Period 2 numbers. They only highlight where Price, Quantity, Channel Mix, Product Mix, or Cost sits in the current level of decomposition.

## Learning flow

1. Revenue — Price vs Volume + Mix
2. Revenue — Price, Quantity, Total Mix
3. Revenue — Price, Quantity, Channel Mix, Product Mix
4. Gross Profit — Price, Volume + Mix, Cost
5. Gross Profit — Price, Quantity, Total Mix, Cost
6. Gross Profit — Price, Quantity, Channel Mix, Product Mix, Cost
7. Interpretation Lab

## Method

The detailed mix decomposition uses **Channel first → Product within Channel**. Quantity and Mix effects use Period-1 economics as the baseline so Price and Cost are isolated cleanly.

Every analytical page uses a true waterfall:

**Period 1 total → floating incremental drivers → Period 2 total**

Displayed business numbers use full Indonesian-style thousands separators such as `12.880`, not compact labels such as `12.9k`.

The browser runs reconciliation and source-of-truth checks on load. The header shows the verification status.

## Files

- `index.html` — learning flow
- `styles.css` — visual system
- `app.js` — master dataset, calculations, waterfall rendering, calculation walkthrough, checks
- `.github/workflows/pages.yml` — GitHub Pages deployment

All business data in this repository are illustrative.
