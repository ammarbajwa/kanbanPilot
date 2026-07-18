import { test } from "node:test";
import assert from "node:assert/strict";
import { getGreeting, renderGreeting, getPinkColor } from "./app.mjs";

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
