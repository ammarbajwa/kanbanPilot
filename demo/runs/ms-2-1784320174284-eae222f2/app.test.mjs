import { test } from "node:test";
import assert from "node:assert/strict";
import { getGreeting, renderGreeting } from "./app.mjs";

test("getGreeting says hello to Ammar and Shahzaib", () => {
  const greeting = getGreeting();
  assert.match(greeting, /Ammar/);
  assert.match(greeting, /Shahzaib/);
  assert.match(greeting, /Hello/i);
});

test("rendered greeting text is pink", () => {
  const html = renderGreeting();
  // Acceptance criterion: text should be pink.
  // Verify a pink color is applied via inline style.
  assert.match(html, /color:\s*#ff69b4/i, "expected pink color (#ff69b4) in inline style");
  assert.match(html, /Hello Ammar and Shahzaib/);
});
