import { DEFAULT_PAGE_SIZE, DEFAULT_DATA_TYPES, API_REQUEST_NUTRIENT_NUMBERS } from '../constants';
import { FDCSearchResponse, FDCFoodItem, USDAFoodRaw, NormalizedFood } from '../types';
import { supabase } from './supabase';
import { normalizeFoodItem } from './normalizer';

/**
 * USDA Service Configuration & Documentation
 * 
 * INTERACTION WITH EDGE FUNCTION (usda-proxy):
 * The 'usda-proxy' function is designed to ALWAYS return HTTP 200 OK, even if the upstream USDA API fails.
 * This prevents Supabase 'invoke' from throwing generic errors and allows the client to handle specific USDA codes.
 * 
 * RESPONSE STRUCTURE:
 * {
 *   success: boolean,      // true if USDA responded with 200 OK
 *   status: number,        // The actual HTTP status from USDA (e.g., 200, 400, 404, 429, 500)
 *   data: any | null,      // The JSON payload if successful
 *   error: string | null   // Error message if success is false
 * }
 * 
 * EDGE FUNCTION LOGGING:
 * The proxy logs the following for debugging:
 * - Incoming request action + params
 * - Target USDA URL
 * - HTTP Method + Body
 * - USDA raw status
 * - USDA safe JSON parsing result
 * - Final response returned to the client
 * - Note: The proxy may return HTML or empty bodies on network failure; client-side logging helps diagnose this.
 * 
 * ERROR HANDLING:
 * - 'invokeError': Indicates a network failure reaching Supabase.
 * - '!response.success': Indicates the USDA API returned an error (handled internally via retries where applicable).
 * 
 * RETRY & FALLBACK LOGIC:
 * - Implements a 'withRetry' wrapper for robust network handling.
 * - Attempt 1: Optimized Fetch (Details) or Standard Search.
 * - Attempt 2+: Fallback triggers if configured.
 * - Cache: Valid responses are cached in Supabase 'usda_food_raw' table for 30 days.
 */

class USDAService {
  private CACHE_TTL_DAYS = 30;

  private isCacheValid(fetchedAt: string): boolean {
    const fetchedDate = new Date(fetchedAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - fetchedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= this.CACHE_TTL_DAYS;
  }

  // Generic Retry Wrapper
  private async withRetry<T>(
    operation: () => Promise<T>,
    onRetry?: (attempt: number) => void,
    retries = 3,
    delay = 400
  ): Promise<T> {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        // Don't wait on the last attempt
        if (i < retries - 1) {
           const attemptNum = i + 1;
           if (onRetry) onRetry(attemptNum);
           console.log(`[usdaService] Retry attempt ${attemptNum}/${retries} after error:`, error);
           await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }

  async searchFoods(
    query: string, 
    onRetry?: (attempt: number) => void,
    pageNumber = 1, 
    dataTypes = DEFAULT_DATA_TYPES
  ): Promise<FDCSearchResponse> {
    
    return this.withRetry(async () => {
        const requestBody = {
          action: 'search',
          query: query,
          dataType: dataTypes,
          pageSize: DEFAULT_PAGE_SIZE,
          pageNumber: pageNumber,
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        };

        const { data: proxyRes, error: invokeError } = await supabase.functions.invoke('usda-proxy', {
          body: requestBody
        });

        console.groupCollapsed("[usdaService] Proxy Response (Search)");
        console.log("Action: search");
        console.log("Params:", requestBody);
        console.log("Raw Supabase response:", { data: proxyRes, error: invokeError });
        
        if (!proxyRes) {
          console.error("[usdaService] ERROR: Proxy returned null or undefined.");
        } else if (!proxyRes.success) {
          console.error("[usdaService] USDA signaled failure:", proxyRes);
        }
        console.groupEnd();

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to contact search proxy');
        }

        if (!proxyRes || !proxyRes.success) {
          const errorMsg = proxyRes?.error || `USDA Search Error: Status ${proxyRes?.status}`;
          throw new Error(errorMsg);
        }

        return proxyRes.data as FDCSearchResponse;
    }, onRetry);
  }

  async getFoodDetails(fdcId: number, onRetry?: (attempt: number) => void): Promise<NormalizedFood> {
    const startTotal = performance.now();
    let networkTime = 0;
    let source = 'Cache';
    let foodData: FDCFoodItem | null = null;

    // 1. Check Cache First (No retry needed for DB cache)
    try {
      const { data: cachedData, error } = await supabase
        .from('usda_food_raw')
        .select('*')
        .eq('fdc_id', fdcId)
        .single();

      if (cachedData && !error) {
        const entry = cachedData as USDAFoodRaw;
        if (this.isCacheValid(entry.fetched_at)) {
          // Check if we have a normalized version stored, otherwise normalize raw
          if (entry.normalized_json) {
              const endTotal = performance.now();
              this.logPerformance(fdcId, 'Cache (Normalized)', 0, endTotal - startTotal, 0);
              return entry.normalized_json as NormalizedFood;
          } else {
              // Fallback for older cache entries
              return normalizeFoodItem(entry.raw_json);
          }
        } else {
          console.log(`[Cache Expired] Refreshing ${fdcId} via Proxy`);
        }
      }
    } catch (err) {
      console.warn('Cache lookup check failed/skipped', err);
    }

    // 2. Fetch via Proxy (Edge Function) with Retry Logic
    try {
      foodData = await this.withRetry(async () => {
          const startNetwork = performance.now();
          let fetchedData: FDCFoodItem | null = null;

          // --- ATTEMPT A: Optimized Fetch (Specific Nutrients) ---
          try {
            const invokeBody = {
              action: 'details',
              fdcId: fdcId,
              nutrients: API_REQUEST_NUTRIENT_NUMBERS 
            };

            const { data: proxyRes, error: invokeError } = await supabase.functions.invoke('usda-proxy', {
              body: invokeBody
            });

            console.groupCollapsed(`[usdaService] Proxy Response (Details - Optimized: ${fdcId})`);
            console.log("Action: details (optimized)");
            console.log("Params:", invokeBody);
            console.log("Raw Supabase response:", { data: proxyRes, error: invokeError });
            console.groupEnd();

            if (invokeError) throw invokeError;
            if (!proxyRes || !proxyRes.success) throw new Error(proxyRes?.error || `USDA API Error`);
            if (!proxyRes.data) throw new Error('No data returned');
            
            fetchedData = proxyRes.data;

          } catch (firstError) {
             console.warn(`[USDA] Optimized fetch failed for ID ${fdcId}. Initiating Fallback...`);
             // Internal swallow to trigger fallback below
          }

          // --- ATTEMPT B: Fallback Fetch (Full Data) ---
          if (!fetchedData) {
              const invokeBody = {
                action: 'details',
                fdcId: fdcId
              };

              const { data: proxyRes, error: invokeError } = await supabase.functions.invoke('usda-proxy', {
                body: invokeBody
              });

              console.groupCollapsed(`[usdaService] Proxy Response (Details - Fallback: ${fdcId})`);
              console.log("Action: details (fallback)");
              console.log("Params:", invokeBody);
              console.log("Raw Supabase response:", { data: proxyRes, error: invokeError });
              
              if (!proxyRes || !proxyRes.success) {
                 console.error("[usdaService] USDA signaled failure in fallback:", proxyRes);
              }
              console.groupEnd();

              if (invokeError) throw invokeError;
              if (!proxyRes || !proxyRes.success) throw new Error(proxyRes?.error || `USDA Fallback Error`);
              
              fetchedData = proxyRes.data;
          }

          if (!fetchedData) throw new Error("Both fetch strategies failed.");

          const endNetwork = performance.now();
          networkTime = endNetwork - startNetwork;
          return fetchedData;
      }, onRetry);

      if (!foodData) throw new Error("Failed to retrieve food data.");

      // 3. Normalize & Cache
      const normalizedData = normalizeFoodItem(foodData);
      source = 'Network';

      // Fire and forget cache update
      this.saveToCache(fdcId, foodData, normalizedData).catch(err => 
        console.error('Background cache save failed:', err)
      );

      const endTotal = performance.now();
      this.logPerformance(fdcId, source, networkTime, endTotal - startTotal, foodData.foodNutrients?.length || 0);
      
      return normalizedData;

    } catch (error) {
      console.error(`Error processing food ${fdcId}:`, error);
      throw error;
    }
  }

  private async saveToCache(fdcId: number, rawData: FDCFoodItem, normalizedData: NormalizedFood) {
    try {
      const { error } = await supabase
        .from('usda_food_raw')
        .upsert({
          fdc_id: fdcId,
          data_type: rawData.dataType,
          raw_json: rawData,
          fetched_at: new Date().toISOString(),
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
