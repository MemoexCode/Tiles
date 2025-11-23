
import { DEFAULT_PAGE_SIZE, DEFAULT_DATA_TYPES, API_REQUEST_NUTRIENT_NUMBERS } from '../constants';
import { FDCSearchResponse, FDCFoodItem, USDAFoodRaw } from '../types';
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
 * - Attempt 1: Optimized Fetch requesting only specific nutrient IDs (API_REQUEST_NUTRIENT_NUMBERS) to minimize packet size.
 * - Attempt 2: Fallback to Full Fetch if Attempt 1 fails (e.g., partial data, strict parsing issues).
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

  async searchFoods(
    query: string, 
    pageNumber = 1, 
    dataTypes = DEFAULT_DATA_TYPES
  ): Promise<FDCSearchResponse> {
    try {
      const requestBody = {
        action: 'search',
        query: query,
        dataType: dataTypes,
        pageSize: DEFAULT_PAGE_SIZE,
        pageNumber: pageNumber,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc'
      };

      // NOTE: Proxy always returns 200. We must parse the wrapper.
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
        console.error('Supabase Search Invocation Error:', invokeError);
        throw new Error(invokeError.message || 'Failed to contact search proxy');
      }

      if (!proxyRes || !proxyRes.success) {
        const errorMsg = proxyRes?.error || `USDA Search Error: Status ${proxyRes?.status}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      return proxyRes.data as FDCSearchResponse;

    } catch (error) {
      console.error('Error searching foods:', error);
      throw error;
    }
  }

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
          const endTotal = performance.now();
          this.logPerformance(fdcId, 'Cache', 0, endTotal - startTotal, entry.raw_json.foodNutrients?.length || 0);
          return entry.raw_json;
        } else {
          console.log(`[Cache Expired] Refreshing ${fdcId} via Proxy`);
        }
      }
    } catch (err) {
      console.warn('Cache lookup check failed/skipped', err);
    }

    // 2. Fetch via Proxy (Edge Function) with Fallback Strategy
    try {
      const startNetwork = performance.now();
      let foodData: FDCFoodItem | null = null;

      // --- ATTEMPT 1: Optimized Fetch (Specific Nutrients) ---
      try {
        const invokeBody = {
          action: 'details',
          fdcId: fdcId,
          nutrients: API_REQUEST_NUTRIENT_NUMBERS 
        };

        // Proxy Request: Expect { success, status, data, error }
        const { data: proxyRes, error: invokeError } = await supabase.functions.invoke('usda-proxy', {
          body: invokeBody
        });

        console.groupCollapsed(`[usdaService] Proxy Response (Details - Optimized: ${fdcId})`);
        console.log("Action: details (optimized)");
        console.log("Params:", invokeBody);
        console.log("Raw Supabase response:", { data: proxyRes, error: invokeError });

        if (!proxyRes) {
          console.error("[usdaService] ERROR: Proxy returned null or undefined.");
        } else if (!proxyRes.success) {
          console.error("[usdaService] USDA signaled failure:", proxyRes);
        }
        console.groupEnd();

        if (invokeError) throw invokeError;
        
        // If USDA returned an error (e.g. 400/500), proxyRes.success will be false.
        if (!proxyRes || !proxyRes.success) {
            throw new Error(proxyRes?.error || `USDA API Error ${proxyRes?.status}`);
        }
        
        if (!proxyRes.data) throw new Error('No data returned from optimized fetch');
        
        foodData = proxyRes.data;

      } catch (firstError) {
        console.warn(`[USDA] Optimized fetch failed for ID ${fdcId}. Reason:`, firstError);
        console.warn(`[USDA] Initiating Fallback: Full Dataset Fetch...`);
        // Swallow error to allow fallback
      }

      // --- ATTEMPT 2: Fallback Fetch (Full Data) ---
      if (!foodData) {
        try {
          const invokeBody = {
            action: 'details',
            fdcId: fdcId
            // No 'nutrients' param -> Full Fetch
          };

          const { data: proxyRes, error: invokeError } = await supabase.functions.invoke('usda-proxy', {
            body: invokeBody
          });

          console.groupCollapsed(`[usdaService] Proxy Response (Details - Fallback: ${fdcId})`);
          console.log("Action: details (fallback)");
          console.log("Params:", invokeBody);
          console.log("Raw Supabase response:", { data: proxyRes, error: invokeError });

          if (!proxyRes) {
            console.error("[usdaService] ERROR: Proxy returned null or undefined.");
          } else if (!proxyRes.success) {
            console.error("[usdaService] USDA signaled failure:", proxyRes);
          }
          console.groupEnd();

          if (invokeError) throw invokeError;

          if (!proxyRes || !proxyRes.success) {
            throw new Error(proxyRes?.error || `USDA Fallback Error ${proxyRes?.status}`);
          }

          if (!proxyRes.data) throw new Error('Fallback fetch returned no data');
          
          foodData = proxyRes.data;

        } catch (secondError) {
          console.error(`[USDA] Critical: Both fetch attempts failed for ID ${fdcId}.`, secondError);
          throw secondError;
        }
      }

      const endNetwork = performance.now();
      networkTime = endNetwork - startNetwork;
      source = 'Network';

      // 3. Save to Cache & Normalize
      if (foodData) {
        this.saveToCache(fdcId, foodData).catch(err => 
          console.error('Background cache save failed:', err)
        );

        const endTotal = performance.now();
        this.logPerformance(fdcId, source, networkTime, endTotal - startTotal, foodData.foodNutrients?.length || 0);
        
        return foodData;
      } else {
        throw new Error('Unexpected state: No food data available after success path');
      }

    } catch (error) {
      console.error(`Error processing food ${fdcId}:`, error);
      throw error;
    }
  }

  private async saveToCache(fdcId: number, data: FDCFoodItem) {
    try {
      const normalizedData = normalizeFoodItem(data);

      const { error } = await supabase
        .from('usda_food_raw')
        .upsert({
          fdc_id: fdcId,
          data_type: data.dataType,
          raw_json: data,
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
