
import { supabase } from './supabase';
import { TilesFoodSearchResult } from '../types';

interface SearchParams {
  langCode?: string;
  query: string;
  limit?: number;
}

export async function searchTilesFood({
  langCode = 'de',
  query,
  limit = 20
}: SearchParams): Promise<TilesFoodSearchResult[]> {
  // If query is empty or just whitespace, return empty immediately
  if (!query || !query.trim()) {
    return [];
  }

  const { data, error } = await supabase.rpc('search_tiles_food', {
    p_lang_code: langCode,
    p_query: query,
    p_limit: limit
  });

  if (error) {
    console.error('Error executing search_tiles_food RPC:', error);
    throw new Error(`Tiles Search Error: ${error.message}`);
  }

  if (!data) {
    return [];
  }

  // Map snake_case database results to CamelCase TypeScript interface
  // The RPC returns columns: food_id, canonical_key, canonical_name, etc.
  return data.map((item: any) => ({
    foodId: item.food_id,
    canonicalKey: item.canonical_key,
    canonicalName: item.canonical_name,
    visualGroupKey: item.visual_group_key,
    visualParentId: item.visual_parent_id,
    defaultFdcId: item.default_fdc_id,
    defaultDataset: item.default_dataset,
    tags: item.tags,
    langCode: item.lang_code,
    primaryLabel: item.primary_label,
    synonyms: item.synonyms,
    score: item.score,
    foodCategory: item.food_category,
    usdaDataType: item.usda_data_type
  }));
}
