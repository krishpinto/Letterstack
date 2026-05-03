// Utility functions used across the entire pipeline
// No dependencies on anything else in the project

export function extractDomain(input: string): string {
  // Turns "https://www.company.com/about" into "company.com"
  // Used in normalize.ts to get domain from any website URL
  try {
    const url = input.startsWith("http") ? input : `https://${input}`;
    return new URL(url).hostname.replace("www.", "").toLowerCase().trim();
  } catch {
    return input.toLowerCase().trim();
  }
}

export function parseName(fullName: string): { firstName: string; lastName: string } {
  // Splits "John Smith" into { firstName: "John", lastName: "Smith" }
  // Used in normalize.ts when source only gives a full name field
  // Also used in inference.ts to generate email candidates
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function normalizeEmail(email: string): string {
  // Lowercase and trim — used in dedupe.ts for consistent comparison
  return email.toLowerCase().trim();
}

export function normalizePhone(phone: string): string {
  // Strips everything except digits and + — used in normalize.ts
  return phone.replace(/[^0-9+]/g, "").trim();
}

export function cleanString(str: string): string {
  // Trims and collapses multiple spaces — used everywhere in normalize.ts
  return str?.trim().replace(/\s+/g, " ") ?? "";
}

export function isValidEmail(email: string): boolean {
  // Basic email format check — used in normalize.ts before even attempting SMTP
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidDomain(domain: string): boolean {
  // Used in validator.ts and inference.ts before doing MX lookup
  return /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/.test(domain);
}