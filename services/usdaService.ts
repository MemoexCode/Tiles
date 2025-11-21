
import { DEFAULT_PAGE_SIZE, DEFAULT_DATA_TYPES, API_REQUEST_NUTRIENT_NUMBERS } from '../constants';
import { FDCSearchResponse, FDCFoodItem, USDAFoodRaw } from '../types';
import { supabase } from './supabase';
import { normalizeFoodItem } from './normalizer';

class USDAService {
  private CACHE_TTL_DAYS = 30; // Validity of cache according to dossier

  /**
   * Checks if a cache entry is valid (younger than 30 days)
   */
  private isCacheValid(fetchedAt: string): boolean {
    const fetchedDate = new Date(fetchedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - fetchedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= this.CACHE_TTL_DAYS;
  }

  /**
   * Search (Raw-Client via Proxy)
   * Calls the Supabase Edge Function 'usda-proxy'.
   * The Edge Function handles the API Key injection securely.
   */
  async searchFoods(
    query: string, 
    pageNumber = 1, 
    dataTypes = DEFAULT_DATA_TYPES
  ): Promise<FDCSearchResponse> {
    
    try {
      const { data, error } = await supabase.functions.invoke('usda-proxy', {
        body: {
          action: 'search',
          query,
          dataType: dataTypes,
          pageSize: DEFAULT_PAGE_SIZE,
          pageNumber,
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        }
      });

      if (error) {
        console.error('Supabase Function Error:', error);
        throw new Error(error.message || 'Failed to invoke search proxy');
      }

      // The proxy returns the exact JSON from USDA
      return data;

    } catch (error) {
      console.error('Error searching foods:', error);
      throw error;
    }
  }

  /**
   * Detail Retrieval with Caching Strategy (Persistence Layer)
   * Flow:
   * 1. Check Cache (Supabase DB)
   * 2. If Hit & Valid -> Return Cache
   * 3. If Miss or Expired -> Call Edge Function -> Save to DB -> Return
   */
  async getFoodDetails(fdcId: number): Promise<FDCFoodItem> {
    const startTotal = performance.now();
    let networkTime = 0;
    let source = 'Cache';

    // 1. Check Cache
    try {
      const { data: cachedData, error } = await supabase
        .from('usda_food_raw')
        .select('*')
        .eq('fdc_id', fdcId)
        .single();

      if (cachedData && !error) {
        const entry = cachedData as USDAFoodRaw;
        if (this.isCacheValid(entry.fetched_at)) {
          // CACHE HIT
          const endTotal = performance.now();
          this.logPerformance(fdcId, 'Cache', 0, endTotal - startTotal, entry.raw_json.foodNutrients?.length || 0);
          return entry.raw_json;
        } else {
          console.log(`[Cache Expired] Refreshing ${fdcId} via Proxy`);
        }
      }
    } catch (err) {
      console.warn('Cache lookup failed, falling back to API', err);
    }

    // 2. Fetch via Proxy (Edge Function)
    try {
      const startNetwork = performance.now();
      const { data, error } = await supabase.functions.invoke('usda-proxy', {
        body: {
          action: 'details',
          fdcId: fdcId,
          // CRITICAL FIX: Use Nutrient Numbers (e.g., 208), not Nutrient IDs (e.g., 1008)
          // The USDA API filter parameter expects legacy numbers.
          nutrients: API_REQUEST_NUTRIENT_NUMBERS 
        }
      });
      const endNetwork = performance.now();
      networkTime = endNetwork - startNetwork;
      source = 'Network';

      if (error) {
         throw new Error(error.message || 'Failed to invoke details proxy');
      }

      const foodData: FDCFoodItem = data;

      // 3. Save to Cache (Persistence & Normalization)
      // We do this client-side here to ensure the specific 'usda_food_raw' table structure 
      // is respected without over-complicating the generic proxy.
      this.saveToCache(fdcId, foodData);

      const endTotal = performance.now();
      this.logPerformance(fdcId, source, networkTime, endTotal - startTotal, foodData.foodNutrients?.length || 0);

      return foodData;
    } catch (error) {
      console.error(`Error fetching food ${fdcId}:`, error);
      throw error;
    }
  }

  /**
   * Saves or updates an entry in Supabase
   * Also performs Normalization
   */
  private async saveToCache(fdcId: number, data: FDCFoodItem) {
    try {
      // Phase 3: Normalization before saving
      const normalizedData = normalizeFoodItem(data);

      const { error } = await supabase
        .from('usda_food_raw')
        .upsert({
          fdc_id: fdcId,
          data_type: data.dataType,
          raw_json: data,
          fetched_at: new Date().toISOString(),
          // Fields for AI Strategy
          visual_parent: normalizedData.visual_parent,
          normalized_json: normalizedData
        }, { onConflict: 'fdc_id' });

      if (error) {
        console.error('Failed to cache food item in Supabase:', error.message);
      }
    } catch (err) {
      console.error('Critical error saving to cache:', err);
    }
  }

  /**
   * Outputs structured performance logs to the developer console
   */
  private logPerformance(fdcId: number, source: string, netTime: number, totalTime: number, items: number) {
    console.groupCollapsed(`[USDA Performance] Food ${fdcId}`);
    console.log(`Source:        ${source}`);
    console.log(`Total Time:    ${totalTime.toFixed(2)}ms`);
    if (netTime > 0) {
      console.log(`Network Latency: ${netTime.toFixed(2)}ms`);
    }
    console.log(`Payload Items: ${items}`);
    console.groupEnd();
  }
}

export const usdaService = new USDAService();
