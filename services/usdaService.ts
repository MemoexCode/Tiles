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
   */
  async searchFoods(
    query: string, 
    pageNumber = 1, 
    dataTypes = DEFAULT_DATA_TYPES
  ): Promise<FDCSearchResponse> {
    
    try {
      // Explicitly construct the body to ensure no extra parameters are sent
      const requestBody = {
        action: 'search',
        query: query,
        dataType: dataTypes,
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber: pageNumber,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc'
      };

      const { data, error } = await supabase.functions.invoke('usda-proxy', {
        body: requestBody
      });

      if (error) {
        // Try to extract helpful message from response context if available
        console.error('Supabase Search Function Error:', error);
        throw new Error(error.message || 'Failed to invoke search proxy');
      }

      return data;

    } catch (error) {
      console.error('Error searching foods:', error);
      throw error;
    }
  }

  /**
   * Detail Retrieval with Caching Strategy (Persistence Layer)
   * Features strict Retry Logic for 400 Bad Request errors.
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
      // Silent fail on cache read, proceed to API
      console.warn('Cache lookup check failed/skipped', err);
    }

    // 2. Fetch via Proxy (Edge Function) with Retry Logic
    try {
      const startNetwork = performance.now();
      let data: FDCFoodItem | null = null;
      let fetchError: any = null;

      // --- ATTEMPT 1: Optimized Fetch (Specific Nutrients) ---
      try {
        const result = await supabase.functions.invoke('usda-proxy', {
          body: {
            action: 'details',
            fdcId: fdcId,
            // Optimization: Request only specific nutrients to reduce packet size
            nutrients: API_REQUEST_NUTRIENT_NUMBERS 
          }
        });

        if (result.error) throw result.error;
        if (!result.data) throw new Error('Empty data returned');
        
        data = result.data;

      } catch (firstError) {
        console.warn(`[USDA] Filtered fetch failed for ID ${fdcId}. Reason:`, firstError);
        console.warn(`[USDA] Initiating Fallback: Full Dataset Fetch...`);

        // --- ATTEMPT 2: Fallback Fetch (Full Data) ---
        // This handles cases where the API rejects the 'nutrients' filter (legacy items)
        // or when a 400 Bad Request occurs due to parameter mismatches.
        const retryResult = await supabase.functions.invoke('usda-proxy', {
          body: {
            action: 'details',
            fdcId: fdcId
            // NO nutrients parameter passed here -> Full Fetch
          }
        });

        if (retryResult.error) {
          fetchError = retryResult.error;
        } else {
          data = retryResult.data;
        }
      }

      const endNetwork = performance.now();
      networkTime = endNetwork - startNetwork;
      source = 'Network';

      // Final Error Check
      if (fetchError || !data) {
         const msg = fetchError?.message || 'Failed to fetch food details after retry.';
         console.error('[USDA] Critical Error:', fetchError);
         throw new Error(msg);
      }

      const foodData: FDCFoodItem = data;

      // 3. Save to Cache (Persistence & Normalization)
      // We perform this asynchronously to not block the UI
      this.saveToCache(fdcId, foodData).catch(err => 
        console.error('Background cache save failed:', err)
      );

      const endTotal = performance.now();
      this.logPerformance(fdcId, source, networkTime, endTotal - startTotal, foodData.foodNutrients?.length || 0);

      return foodData;
    } catch (error) {
      console.error(`Error processing food ${fdcId}:`, error);
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
        // This log helps debugging permission/RLS issues
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