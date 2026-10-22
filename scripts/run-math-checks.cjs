"use strict";

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");

const expectedChecks = 33;
const appPath = resolve(__dirname, "../app.js");
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

const result = window.PVM_LAB_CORE?.runTests();
if (!result) {
  throw new Error("app.js did not expose PVM_LAB_CORE.runTests().");
}
if (result.total !== expectedChecks) {
  throw new Error(
    `Expected ${expectedChecks} math checks, but runTests() defines ${result.total}. Update this guard when the suite changes intentionally.`
  );
}
if (!result.ok || result.passed !== expectedChecks) {
  throw new Error(`PVM math checks failed: ${result.passed}/${result.total} passed.`);
}
if (status.textContent !== `Math verified · ${expectedChecks}/${expectedChecks}`) {
  throw new Error(`Unexpected app status: "${status.textContent}".`);
}

console.log(`PVM math checks passed: ${result.passed}/${result.total}.`);
