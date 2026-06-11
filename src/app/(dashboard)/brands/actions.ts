"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { computeBrandScore } from "@/lib/brand-score";

async function recomputeScore(brandId: string) {
  const supabase = await createClient();

  const [{ data: brand }, { data: voice }, refs, examples] = await Promise.all([
    supabase
      .from("brands")
      .select("logo_url, description, identity")
      .eq("id", brandId)
      .single(),
    supabase
      .from("brand_voice")
      .select("target_audience, content_pillars, characteristic_phrases, forbidden_words")
      .eq("brand_id", brandId)
      .maybeSingle(),
    supabase
      .from("brand_references")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
    supabase
      .from("brand_examples")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brandId),
  ]);

  if (!brand) return;

  const identity = (brand.identity ?? {}) as {
    colors?: string[];
    font_heading?: string;
    font_body?: string;
  };

  const score = computeBrandScore({
    hasLogo: !!brand.logo_url,
    colorsCount: identity.colors?.length ?? 0,
    hasFonts: !!(identity.font_heading || identity.font_body),
    hasDescription: !!brand.description,
    hasAudience: !!voice?.target_audience,
    pillarsCount: voice?.content_pillars?.length ?? 0,
    phrasesCount: voice?.characteristic_phrases?.length ?? 0,
    forbiddenCount: voice?.forbidden_words?.length ?? 0,
    referencesCount: refs.count ?? 0,
    examplesCount: examples.count ?? 0,
  });

  await supabase.from("brands").update({ brand_score: score }).eq("id", brandId);
}

export async function createBrand(formData: FormData) {
  const supabase = await createClient();
  const workspaceId = formData.get("workspaceId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = ((formData.get("description") as string) ?? "").trim();

  if (!name) {
    redirect("/brands/new?error=" + encodeURIComponent("Dê um nome à marca."));
  }

  const brandId = crypto.randomUUID();

  const { error } = await supabase.from("brands").insert({
    id: brandId,
    workspace_id: workspaceId,
    name,
    description: description || null,
  });

  if (error) {
    redirect("/brands/new?error=" + encodeURIComponent("Não foi possível criar a marca."));
  }

  await supabase.from("brand_voice").insert({ brand_id: brandId });
  await recomputeScore(brandId);

  revalidatePath("/brands");
  redirect(`/brands/${brandId}`);
}

export async function updateIdentity(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;

  const colors = JSON.parse((formData.get("colors") as string) || "[]") as string[];

  const { error } = await supabase
    .from("brands")
    .update({
      name: (formData.get("name") as string)?.trim(),
      description: ((formData.get("description") as string) ?? "").trim() || null,
      website: ((formData.get("website") as string) ?? "").trim() || null,
      identity: {
        colors,
        font_heading: ((formData.get("fontHeading") as string) ?? "").trim() || null,
        font_body: ((formData.get("fontBody") as string) ?? "").trim() || null,
      },
    })
    .eq("id", brandId);

  if (!error) await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function updateLogoUrl(brandId: string, logoUrl: string) {
  const supabase = await createClient();
  await supabase.from("brands").update({ logo_url: logoUrl }).eq("id", brandId);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function updateVoice(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;

  const parse = (key: string) =>
    JSON.parse((formData.get(key) as string) || "[]") as string[];

  const { error } = await supabase
    .from("brand_voice")
    .update({
      tone: formData.get("tone") as string,
      target_audience:
        ((formData.get("targetAudience") as string) ?? "").trim() || null,
      content_pillars: parse("pillars"),
      characteristic_phrases: parse("phrases"),
      forbidden_words: parse("forbidden"),
    })
    .eq("brand_id", brandId);

  if (!error) await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function addReference(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  const name = (formData.get("name") as string)?.trim();
  if (!name) return;

  await supabase.from("brand_references").insert({
    brand_id: brandId,
    name,
    handle: ((formData.get("handle") as string) ?? "").trim() || null,
    platforms: JSON.parse((formData.get("platforms") as string) || "[]"),
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
  });

  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function deleteReference(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  await supabase
    .from("brand_references")
    .delete()
    .eq("id", formData.get("referenceId") as string);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function addExample(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  const content = (formData.get("content") as string)?.trim();
  if (!content) return;

  // embedding fica null por enquanto — gerado no Sprint 2 junto com o Generator
  await supabase.from("brand_examples").insert({ brand_id: brandId, content });

  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}

export async function deleteExample(formData: FormData) {
  const supabase = await createClient();
  const brandId = formData.get("brandId") as string;
  await supabase
    .from("brand_examples")
    .delete()
    .eq("id", formData.get("exampleId") as string);
  await recomputeScore(brandId);
  revalidatePath(`/brands/${brandId}`);
}
