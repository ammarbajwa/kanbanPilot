// MS-2: Simple app that says hello to Ammar and Shahzaib.
// The greeting text is styled pink per the acceptance criteria.

const PINK_COLOR = "#ff69b4";

/**
 * Returns the greeting message.
 * @returns {string}
 */
export function getGreeting() {
  return "Hello Ammar and Shahzaib";
}

/**
 * Returns an HTML string rendering the greeting in pink text.
 * @returns {string}
 */
export function renderGreeting() {
  return `<p style="color: ${PINK_COLOR};">${getGreeting()}</p>`;
}

// When run directly, print the rendered greeting.
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(renderGreeting());
}
