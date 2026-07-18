import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getGreeting, renderGreeting, getPinkColor, isNode } from "./app.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

test("getGreeting says hello to Ammar and Shahzaib", () => {
  const greeting = getGreeting();
  assert.match(greeting, /Ammar/);
  assert.match(greeting, /Shahzaib/);
  assert.match(greeting, /Hello/i);
});

test("rendered greeting is a clear pink heading", () => {
  const html = renderGreeting();
  // Acceptance criterion: text should be pink.
  // Verify a clear pink color is applied via inline style on a heading element.
  assert.match(
    html,
    /<h1[^>]*class="pink-greeting"[^>]*style="[^"]*color:\s*#ff69b4[^"]*"[^>]*>/i,
    "expected an <h1 class=\"pink-greeting\"> with pink color (#ff69b4) in inline style"
  );
  assert.match(html, /<\/h1>/, "expected a closing </h1> tag");
});

test("rendered heading contains the exact greeting text", () => {
  const html = renderGreeting();
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  assert.ok(match, "expected an <h1> element in rendered output");
  const renderedText = match[1];
  assert.equal(
    renderedText,
    "Hello Ammar and Shahzaib",
    "rendered heading text must match the greeting"
  );
  assert.match(renderedText, /Ammar/);
  assert.match(renderedText, /Shahzaib/);
});

test("rendered text is non-empty and human-readable", () => {
  const html = renderGreeting();
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  assert.ok(match, "expected an <h1> element in rendered output");
  const renderedText = match[1].trim();
  assert.ok(renderedText.length > 0, "rendered text must not be empty");
  assert.ok(
    !/[<>]/.test(renderedText),
    "rendered text must be plain text without nested tags"
  );
  assert.equal(renderedText, getGreeting());
});

test("pink color is a clearly pink shade", () => {
  const color = getPinkColor();
  assert.equal(color, "#ff69b4", "expected hot pink (#ff69b4) for a clear pink heading");
});

test("app.mjs guards process usage so it is browser-safe", () => {
  // isNode() must be a guarded, side-effect-free check that does not throw.
  assert.equal(typeof isNode(), "boolean", "isNode() should return a boolean");
  // Under node:test we are running in Node, so the guard should detect it.
  assert.equal(isNode(), true, "isNode() should be true when running under Node.js");
});

test("index.html exists and imports app.mjs to render the greeting", () => {
  const html = readFileSync(join(__dirname, "index.html"), "utf8");

  // Must be a valid HTML document.
  assert.match(html, /<!DOCTYPE html>/i, "expected a DOCTYPE declaration");
  assert.match(html, /<html/i, "expected an <html> element");

  // Must import app.mjs as an ES module.
  assert.match(
    html,
    /import\s+\{[^}]*renderGreeting[^}]*\}\s+from\s+["']\.\/app\.mjs["']/,
    "expected an ES module import of renderGreeting from ./app.mjs"
  );

  // Must render the greeting into the DOM.
  assert.match(html, /innerHTML\s*=\s*renderGreeting\(\)/, "expected renderGreeting() to be injected into the DOM");
});

test("index.html does not reference process directly (browser-safe)", () => {
  const html = readFileSync(join(__dirname, "index.html"), "utf8");
  assert.doesNotMatch(
    html,
    /\bprocess\b/,
    "index.html must not reference process so it stays browser-safe"
  );
});
