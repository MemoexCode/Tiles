import { supabase } from './supabase';
import { API_REQUEST_NUTRIENT_NUMBERS } from '../constants';
import { NormalizedFood, FDCFoodItem } from '../types';
import { normalizeFoodItem } from './normalizer';

// Utility: sleep
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generic retry wrapper.
 * The onRetry callback is used by the UI to display text like "Retry 1/3".
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 400,
  onRetry?: (attempt: number) => void
): Promise<T> {
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (onRetry) onRetry(i + 1);
      await pause(delay);
    }
  }

  throw lastError;
}

/**
 * Call the Supabase Edge Function safely.
 */
async function callProxy(action: string, params: any) {
  const { data, error } = await supabase.functions.invoke('usda-proxy', {
    body: { action, ...params },
  });

  if (error) throw new Error(error.message || 'Supabase invoke failed.');

  if (!data) throw new Error('No response from proxy.');

  if (!data.success) {
    const status = data.status ?? '?';
    throw new Error(data.error || `USDA Error (status ${status})`);
  }

  return data.data;
}

export const usdaService = {
  // =========================================================
  // SEARCH FOODS
  // =========================================================
  async searchFoods(
    query: string,
    onRetry?: (attempt: number) => void
  ) {
    const params: any = {
      query,
      dataType: ['Foundation', 'SR Legacy'],
      pageSize: 30
    };

    try {
      // First attempt (full search)
      return await withRetry(
        () => callProxy('search', params),
        3,
        400,
        onRetry
      );
    } catch (err) {
      // Automatic fallback search:
      // Minimal query only (USDA is sometimes picky on params)
      return await withRetry(
        () =>
          callProxy('search', {
            query
          }),
        3,
        400,
        onRetry
      );
    }
  },

  // =========================================================
  // DETAILS
  // =========================================================
  async getFoodDetails(
    fdcId: number,
    onRetry?: (attempt: number) => void
  ): Promise<NormalizedFood> {
    const params = {
      fdcId,
      format: 'full',
      nutrients: API_REQUEST_NUTRIENT_NUMBERS
    };

    const rawData = await withRetry(
      () => callProxy('details', params),
      3,
      400,
      onRetry
    );

    return normalizeFoodItem(rawData);
  }
};
