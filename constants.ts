
// USDA API Configuration
// Base URL is now handled by the Supabase Edge Function, but kept here for reference/types if needed.
export const USDA_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

// Key Nutrient IDs based on USDA SR Legacy & Foundation Foods documentation
export const NUTRIENT_IDS = {
  ENERGY_KCAL: 1008, // Standard Energy
  ENERGY_ATWATER_GENERAL: 2047, // Specific calculation
  ENERGY_ATWATER_SPECIFIC: 2048, // Specific calculation
  PROTEIN: 1003,
  TOTAL_LIPID_FAT: 1004,
  CARBOHYDRATE_BY_DIFF: 1005,
  FIBER_TOTAL_DIETARY: 1079,
  SUGARS_TOTAL: 2000,
  CALCIUM: 1087,
  IRON: 1089,
  SODIUM: 1093,
  VITAMIN_C: 1162,
  CHOLESTEROL: 1253,
  FATTY_ACIDS_SATURATED: 1258,
};

// Display names for the UI. 
// NOTE: We ONLY map the primary ID 1008 to 'Calories'. 
// 2047 and 2048 are intentionally removed to prevent duplicate "Calories" rows in the UI.
// The normalizer may still use them for calculation, but the Details View will filter/hide them 
// if ID 1008 is present, or show their raw API names if not.
export const NUTRIENT_DISPLAY_NAMES: Record<number, string> = {
  1008: 'Calories', 
  1003: 'Protein',
  1004: 'Total Fat',
  1005: 'Carbs',
  1079: 'Fiber',
  2000: 'Sugars',
  1093: 'Sodium',
  1087: 'Calcium',
  1089: 'Iron',
  1162: 'Vitamin C',
  1253: 'Cholesterol',
  1258: 'Saturated Fat'
};

// Request defaults
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_DATA_TYPES = ['Foundation', 'SR Legacy'];