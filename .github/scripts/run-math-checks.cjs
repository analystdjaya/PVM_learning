"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const expectedChecks = 33;
const expectedScenarioChecks = 22;
const appPath = resolve(__dirname, "../../app.js");
const appSource = readFileSync(appPath, "utf8");

// Run the production script with a minimal DOM shim; the math checks need no browser.
const status = { textContent: "", style: {} };
const progressButton = { classList: { add() {} } };
const progress = {
  appendChild() {},
  querySelector(selector) {
    return selector === "button" ? progressButton : null;
  }
};

const document = {
  querySelector(selector) {
    return selector === ".progress" ? progress : null;
  },
  createElement(tagName) {
    return { tagName, dataset: {}, classList: { add() {} } };
  },
  querySelectorAll() {
    return [];
  },
  getElementById(id) {
    return id === "mathStatus" ? status : null;
  },
  addEventListener() {}
};
const window = {
  innerWidth: 1024,
  addEventListener() {},
  scrollTo() {}
};

runInNewContext(appSource, { document, window }, { filename: appPath });

const core = window.PVM_LAB_CORE;
const result = core?.runTests();
if (!result) {
  throw new Error("app.js did not expose PVM_LAB_CORE.runTests().");
}
if (result.total !== expectedChecks) {
  throw new Error(
    "Expected " + expectedChecks + " core math checks, but runTests() defines " + result.total + ". Update this guard when the suite changes intentionally."
  );
}
if (!Array.isArray(result.failures)) {
  throw new Error("runTests() must return named failures for actionable diagnostics.");
}
if (!result.ok || result.passed !== expectedChecks) {
  const detail = result.failures.length
    ? "\nFailed core checks:\n - " + result.failures.join("\n - ")
    : "";
  throw new Error(
    "PVM math checks failed: " + result.passed + "/" + result.total + " passed." + detail
  );
}
if (status.textContent !== "Math verified · " + expectedChecks + "/" + expectedChecks) {
  throw new Error("Unexpected app status: \"" + status.textContent + "\".");
}

const scenarioRows = [
  { channel: "General Trade", sku: "Value", q1: 100, p1: 10, c1: 6, q2: 120, p2: 11, c2: 7 },
  { channel: "General Trade", sku: "Core", q1: 50, p1: 15, c1: 10, q2: 0, p2: 16, c2: 11 },
  { channel: "General Trade", sku: "New", q1: 0, p1: 20, c1: 14, q2: 30, p2: 22, c2: 15 },
  { channel: "Modern Trade", sku: "Value", q1: 80, p1: 12, c1: 8, q2: 50, p2: 13, c2: 8 },
  { channel: "Modern Trade", sku: "Core", q1: 60, p1: 16, c1: 11, q2: 100, p2: 16, c2: 12 },
  { channel: "Food Service", sku: "Premium", q1: 90, p1: 25, c1: 15, q2: 110, p2: 26, c2: 16 },
  { channel: "Food Service", sku: "Legacy", q1: 60, p1: 9, c1: 6, q2: 100, p2: 9, c2: 7 }
];
const scenario = core.calc(scenarioRows);
const expectedValues = [
  ["Revenue opening value", scenario.rev1, 6460],
  ["Revenue closing value", scenario.rev2, 7990],
  ["GP opening value", scenario.gp1, 2350],
  ["GP closing value", scenario.gp2, 2640],
  ["Price impact", scenario.price, 340],
  ["Cost impact", scenario.cost, -460],
  ["Revenue volume/mix impact", scenario.volumeMixR, 1190],
  ["GP volume/mix impact", scenario.volumeMixGP, 410],
  ["Revenue quantity impact", scenario.quantityR, 1027.7272727272727],
  ["Revenue total mix impact", scenario.totalMixR, 162.27272727272725],
  ["Revenue channel mix impact", scenario.channelMixR, 225.41558441558493],
  ["Revenue product mix impact", scenario.productMixR, -63.1428571428568],
  ["GP quantity impact", scenario.quantityGP, 373.8636363636364],
  ["GP total mix impact", scenario.totalMixGP, 36.136363636363626],
  ["GP channel mix impact", scenario.channelMixGP, 102.42207792207807],
  ["GP product mix impact", scenario.productMixGP, -66.28571428571414]
];
const reconciliations = [
  ["Revenue bridge", scenario.rev2 - scenario.rev1, scenario.price + scenario.volumeMixR],
  ["Revenue volume/mix split", scenario.volumeMixR, scenario.quantityR + scenario.totalMixR],
  ["Revenue total mix split", scenario.totalMixR, scenario.channelMixR + scenario.productMixR],
  ["GP bridge", scenario.gp2 - scenario.gp1, scenario.price + scenario.volumeMixGP + scenario.cost],
  ["GP volume/mix split", scenario.volumeMixGP, scenario.quantityGP + scenario.totalMixGP],
  ["GP total mix split", scenario.totalMixGP, scenario.channelMixGP + scenario.productMixGP]
];
const scenarioChecks = expectedValues.concat(reconciliations).map(function(check) {
  return { name: check[0], pass: close(check[1], check[2]) };
});
function close(actual, expected) {
  return Number.isFinite(actual) &&
    Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(actual), Math.abs(expected));
}
if (scenarioChecks.length !== expectedScenarioChecks) {
  throw new Error(
    "Expected " + expectedScenarioChecks + " SKU-entry/exit checks, but found " + scenarioChecks.length + "."
  );
}
const scenarioFailures = scenarioChecks.filter(function(check) {
  return !check.pass;
}).map(function(check) {
  return check.name;
});
if (scenarioFailures.length) {
  throw new Error(
    "SKU-entry/exit scenario failed: " + scenarioFailures.length + "/" + expectedScenarioChecks + " failed.\nFailed scenario checks:\n - " +
      scenarioFailures.join("\n - ")
  );
}

console.log(
  "PVM math checks passed: " + result.passed + "/" + expectedChecks +
  "; SKU introduction/discontinuation checks passed: " + scenarioChecks.length + "/" + expectedScenarioChecks + "."
);
