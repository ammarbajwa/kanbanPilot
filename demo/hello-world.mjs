/**
 * Hello-world module for the MergeStamp demo.
 *
 * Dependency-free: uses only standard JavaScript (ESM).
 */

/**
 * Return a greeting string for the given name.
 *
 * @param {string} [name] - The name to greet. Defaults to "MergeStamp".
 * @returns {string} The greeting, e.g. "Hello, MergeStamp!".
 */
export function greeting(name = "MergeStamp") {
  return `Hello, ${name}!`;
}

// When run directly via `node demo/hello-world.mjs`, print the default greeting.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(greeting());
}
