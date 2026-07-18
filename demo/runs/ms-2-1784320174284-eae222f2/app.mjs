// MS-2: Simple app that says hello to Ammar and Shahzaib.
// The greeting is rendered as a clear pink heading per the acceptance criteria.
// This module is browser-safe: it guards all process usage so it can be
// imported directly from an ES module <script> in index.html.

const PINK_COLOR = "#ff69b4"; // hot pink — the canonical CSS "pink" family color

/**
 * Returns the greeting message.
 * @returns {string}
 */
export function getGreeting() {
  return "Hello Ammar and Shahzaib";
}

/**
 * Returns the pink color used for the heading.
 * @returns {string}
 */
export function getPinkColor() {
  return PINK_COLOR;
}

/**
 * Returns an HTML string rendering the greeting as a clear pink heading.
 * The heading uses a descriptive class name and an inline style so the pink
 * color is unambiguous and easy to assert on.
 * @returns {string}
 */
export function renderGreeting() {
  return `<h1 class="pink-greeting" style="color: ${PINK_COLOR};">${getGreeting()}</h1>`;
}

/**
 * Returns true when running under Node.js (where `process` is available).
 * Guarded so this module can also be imported in browsers without throwing.
 * @returns {boolean}
 */
export function isNode() {
  return typeof process !== "undefined" &&
    process !== null &&
    typeof process.argv !== "undefined" &&
    Array.isArray(process.argv);
}

// When run directly via `node app.mjs`, print the rendered greeting.
// The process reference is guarded so browsers importing this module are unaffected.
if (isNode() && import.meta.url === `file://${process.argv[1]}`) {
  console.log(renderGreeting());
}
