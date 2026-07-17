// A tiny, dependency-free hello-world module that proves MergeStamp can turn
// a ticket into a validated GitHub pull request.

/**
 * Return a greeting string for the given name.
 * When no name is provided, the default "MergeStamp" is used.
 *
 * @param {string} [name] - Optional name to greet.
 * @returns {string} The greeting message.
 */
export function greeting(name) {
  const who = name === undefined || name === null || name === "" ? "MergeStamp" : name;
  return `Hello, ${who}!`;
}

// When run directly via `node demo/hello-world.mjs`, print the default greeting.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(greeting());
}
