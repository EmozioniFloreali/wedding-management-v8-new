"use server";

import { createClient } from "@/lib/supabase/server";

export async function getChurchPlan(projectId: string) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utente non autenticato");

  const { data, error } = await supabase
    .from("church_plan_elements")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function saveChurchPlan(
  projectId: string,
  elements: Array<Record<string, unknown>>
) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utente non autenticato");

  const { error: deleteError } = await supabase
    .from("church_plan_elements")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) throw new Error(deleteError.message);

  if (!elements.length) return [];

  const rows = elements.map((element, index) => ({
    project_id: projectId,
    element_key: String(element.elementKey ?? ""),
    kind: String(element.kind ?? "composition"),
    view: String(element.view ?? "general"),
    composition_code: element.compositionCode ? String(element.compositionCode) : null,
    source_item_id: element.sourceItemId ? String(element.sourceItemId) : null,
    name: String(element.name ?? ""),
    description: element.description ? String(element.description) : null,
    quantity: Number(element.quantity ?? 1),
    x: Number(element.x ?? 0),
    y: Number(element.y ?? 0),
    width: Number(element.width ?? 10),
    height: Number(element.height ?? 10),
    flowers: element.flowers ?? [],
    colors: element.colors ?? [],
    structure: element.structure ?? null,
    materials: element.materials ?? [],
    notes: element.notes ? String(element.notes) : null,
    sort_order: index
  }));

  const { data, error } = await supabase
    .from("church_plan_elements")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function deleteChurchPlan(projectId: string) {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utente non autenticato");

  const { error } = await supabase
    .from("church_plan_elements")
    .delete()
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  return true;
}
