/**
 * UTILITY: Sequential Transaction Identifier Generator
 * Produces a unique, formatted tracking string following the schema: CMS/{MODULE}/{DATE}/{RANDOM}.
 */

const generateNotrans = (moduleName) => {
  // INITIALIZATION
  // Validate and sanitize input string for module prefix extraction
  let safeModuleName = moduleName;

  if (
    moduleName &&
    typeof moduleName === "string" &&
    moduleName.trim() !== ""
  ) {
    safeModuleName = moduleName.trim();
  }

  // Map module identifier to a truncated uppercase code
  const mod = safeModuleName.substring(0, 4).toUpperCase();

  // REFERENCE GATHERING
  // Aggregate current date components into a serialized YYYYMMDD string
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;

  // Initialize random alphanumeric entropy for collision avoidance
  const randomStr = Math.random().toString(36).substring(2, 7).toUpperCase();

  // EXECUTION
  // Construct and return the final serialized transaction identifier
  const result = `CMS/${mod}/${dateStr}/${randomStr}`;
  console.log(`>>> [GENERATOR] Created Ticket: ${result}`);
  return result;
};

module.exports = { generateNotrans };
