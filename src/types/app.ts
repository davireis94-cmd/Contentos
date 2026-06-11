// Shared app-level types mirroring the database enums.
// Replace with generated types (types/database.ts) once the
// Supabase project is linked: npm run db:types

export type PlanTier = "free" | "starter" | "pro";
export type MemberRole = "owner" | "admin" | "editor";
export type BrandTone =
  | "formal"
  | "conversational"
  | "authority"
  | "minimalist";
export type ContentFormat = "carousel" | "reel" | "story" | "single";
export type ContentStatus =
  | "idea"
  | "scripted"
  | "editing"
  | "scheduled"
  | "published";
export type Platform = "instagram" | "tiktok" | "youtube" | "linkedin" | "x";

export const PLAN_LIMITS: Record<
  PlanTier,
  { generationsPerMonth: number; brands: number; workspaces: number }
> = {
  free: { generationsPerMonth: 5, brands: 1, workspaces: 1 },
  starter: { generationsPerMonth: 30, brands: 3, workspaces: 1 },
  pro: { generationsPerMonth: Infinity, brands: Infinity, workspaces: 3 },
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  idea: "Ideia",
  scripted: "Roteirizado",
  editing: "Em edição",
  scheduled: "Agendado",
  published: "Publicado",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  x: "X",
};
