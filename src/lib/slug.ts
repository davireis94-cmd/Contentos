export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 32);
}

export function workspaceSlug(name: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slugify(name) || "workspace"}-${suffix}`;
}
