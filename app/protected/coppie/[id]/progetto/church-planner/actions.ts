"use server";

import { createClient } from "@/lib/supabase/server";

async function requireAuthenticated() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Utente non autenticato");
  return supabase;
}

function jsonText(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") return value || null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export async function getChurchPlan(projectId: string) {
  const supabase = await requireAuthenticated();

  const { data, error } = await supabase
    .from("church_plan_elements")
    .select("*")
    .eq("church_project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveChurchPlan(
  projectId: string,
  elements: Array<Record<string, unknown>>,
) {
  const supabase = await requireAuthenticated();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
    .maybeSingle();

  if (profile?.role !== "admin") throw new Error("Permessi insufficienti");

  const { error: deleteError } = await supabase
    .from("church_plan_elements")
    .delete()
    .eq("church_project_id", projectId);

  if (deleteError) throw new Error(deleteError.message);

  if (!elements.length) return [];

  const rows = elements.map((element, index) => {
    const kind = String(element.kind ?? "composition");
    const code = String(element.compositionCode || element.elementKey || `E${index + 1}`);
    const numericPart = Number(code.replace(/\D/g, "")) || index + 1;

    return {
      church_project_id: projectId,
      element_number: numericPart,
      position_name: String(element.position ?? ""),
      element_type: kind,
      description: String(element.name ?? element.description ?? ""),
      quantity: Number(element.quantity ?? 1),
      width: Number(element.width ?? 10),
      length: null,
      height: Number(element.height ?? 10),
      flowers: jsonText(element.flowers),
      colors: Array.isArray(element.colors) ? element.colors.filter(Boolean).join(", ") : jsonText(element.colors),
      structure: jsonText(element.structure),
      notes: element.notes ? String(element.notes) : null,
      sort_order: index,
      view: String(element.view ?? "general"),
      x: Number(element.x ?? 50),
      y: Number(element.y ?? 50),
      source_item_id: element.sourceItemId ? String(element.sourceItemId) : null,
      updated_at: new Date().toISOString(),
    };
  });

  const { data, error } = await supabase
    .from("church_plan_elements")
    .insert(rows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function deleteChurchPlan(projectId: string) {
  const supabase = await requireAuthenticated();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
    .maybeSingle();

  if (profile?.role !== "admin") throw new Error("Permessi insufficienti");

  const { error } = await supabase
    .from("church_plan_elements")
    .delete()
    .eq("church_project_id", projectId);

  if (error) throw new Error(error.message);

  return true;
}
