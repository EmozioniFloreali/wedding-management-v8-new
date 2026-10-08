"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";

export async function setCoupleArchived(
  coupleId: string,
  archived: boolean
) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.rpc("set_couple_archived", {
    p_couple_id: coupleId,
    p_archived: archived,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/protected/coppie");
  revalidatePath(`/protected/coppie/${coupleId}`);
  revalidatePath("/protected");
}
