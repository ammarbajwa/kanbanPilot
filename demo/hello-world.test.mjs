import { test } from "node:test";
import assert from "node:assert/strict";
import { greeting } from "./hello-world.mjs";

test("greeting returns a personalized message when a name is provided", () => {
  assert.equal(greeting("World"), "Hello, World!");
});

test("greeting returns the default MergeStamp greeting when no name is given", () => {
  assert.equal(greeting(), "Hello, MergeStamp!");
});

test("greeting returns the default MergeStamp greeting when name is empty", () => {
  assert.equal(greeting(""), "Hello, MergeStamp!");
});
