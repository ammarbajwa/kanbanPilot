import { test } from "node:test";
import assert from "node:assert/strict";

import { greeting } from "./hello-world.mjs";

test("greeting with a named argument returns Hello, {name}!", () => {
  assert.equal(greeting("World"), "Hello, World!");
});

test("greeting without a name returns Hello, MergeStamp!", () => {
  assert.equal(greeting(), "Hello, MergeStamp!");
});
