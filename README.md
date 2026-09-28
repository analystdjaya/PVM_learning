# PVM Learning Lab

A visual-first learning tool for understanding Revenue and Gross Profit Price–Volume–Mix decomposition.

Live site: https://analystdjaya.github.io/PVM_learning/

## Objective

The learning flow is designed to help analysts:

1. understand why Revenue / Gross Profit changed;
2. isolate the mathematical driver;
3. interpret what the result means without overclaiming;
4. explain the result clearly to business stakeholders.

A key mindset is that **Quantity growth is not automatically the same as Volume + Mix**.

The same bridge logic can be used against different benchmarks: previous period, Budget, Target, Standard, or a relevant cross-section.

## Core learning rule

The **Step 6 Mixed Reality bridge is the source of truth**. One master Product × Channel dataset drives every Revenue and Gross Profit page.

Earlier steps never create a different example. They only combine the same detailed drivers:

- Volume + Mix = Quantity + Total Mix
- Total Mix = Channel Mix + Product Mix
- Gross Profit adds Cost

Each step exposes only the drivers that exist at that level:

1. Revenue — Price | Volume + Mix
2. Revenue — Price | Quantity | Total Mix
3. Revenue — Price | Quantity | Channel Mix | Product Mix
4. Gross Profit — Price | Volume + Mix | Cost
5. Gross Profit — Price | Quantity | Total Mix | Cost
6. Gross Profit — Price | Quantity | Channel Mix | Product Mix | Cost

The driver-focus controls never change the master dataset. They only visually isolate the selected driver.

## Calculation walkthrough

Each analytical page includes **Show the calculation**, which presents:

- formula;
- Compare A vs B counterfactual;
- actual numbers;
- what is held constant;
- short business meaning.

The detailed mix decomposition uses **Channel first → Product within Channel**. Quantity and Mix effects use Period-1 economics as the baseline so Price and Cost are isolated cleanly.

Every analytical page uses a true waterfall:

**Period 1 total → floating incremental drivers → Period 2 total**

Displayed business numbers use full Indonesian-style thousands separators such as `12.880`.

The browser runs reconciliation and counterfactual checks on load. The header shows the verification status.

All business data in this repository are illustrative.
