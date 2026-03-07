
"use server";

import { searchBtiRulings, getBtiStats, BtiSearchOptions } from "@/lib/eu/bti-search";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export async function searchBtiAction(input: BtiSearchOptions) {
  await requireAuthenticatedUser();
  
  try {
    const results = await searchBtiRulings(input);
    return { success: true, data: results };
  } catch (error) {
    console.error("BTI Search Action Error:", error);
    return { success: false, error: "Failed to search BTI rulings" };
  }
}

export async function getBtiStatsAction() {
  await requireAuthenticatedUser();
  
  try {
    const stats = await getBtiStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error("BTI Stats Action Error:", error);
    return { success: false, error: "Failed to get BTI stats" };
  }
}
