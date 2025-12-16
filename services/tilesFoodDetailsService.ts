import { supabase } from './supabase';

export async function getTilesFoodDetails(foodId: string, langCode: string = 'de'): Promise<any | null> {
  const { data, error } = await supabase.rpc('get_tiles_food_details', {
    p_food_id: foodId,
    p_lang_code: langCode
  });

  if (error) {
    throw new Error(`get_tiles_food_details RPC error: ${error.message}`);
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  // The RPC returns a table, but we expect a single row for a specific ID
  return data[0];
}