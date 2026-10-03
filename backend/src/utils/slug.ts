export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Ensures a slug is unique against a resolver (db lookup). */
export async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>): Promise<string> {
  const candidate = slugify(base);
  if (!(await exists(candidate))) return candidate;
  let i = 2;
  while (await exists(`${candidate}-${i}`)) i += 1;
  return `${candidate}-${i}`;
}

export function orderNumberFrom(counter: number, date = new Date()): string {
  const year = date.getFullYear();
  const seq = String(counter).padStart(6, "0");
  return `CH-${year}-${seq}`;
}
