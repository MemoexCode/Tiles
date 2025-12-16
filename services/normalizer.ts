import { FDCFoodItem, FoodPortion, NormalizedFoodPortion, NormalizedFood } from '../types';
import { NUTRIENT_IDS } from '../constants';

/**
 * Hilfsfunktion, um einen Nährwert sicher zu finden.
 * FIX: Iteriert jetzt über die PRIORITÄTEN-Liste (ids) zuerst, statt über die API-Liste.
 * Das garantiert, dass die Reihenfolge im 'possibleIds' Array eingehalten wird.
 */
const getValue = (food: FDCFoodItem, possibleIds: number | number[]): number => {
  const ids = Array.isArray(possibleIds) ? possibleIds : [possibleIds];
  
  // Wir gehen unsere Wunsch-IDs der Reihe nach durch (Priorität)
  for (const targetId of ids) {
    const nutrientItem = food.foodNutrients.find(n => {
      // 1. Check Flat Structure (Search Results / Legacy)
      if (n.nutrientId === targetId) return true;
      
      // 2. Check Nested Structure (Foundation Foods Detail View)
      if (n.nutrient?.id === targetId) return true;
      
      return false;
    });
    
    // Wenn wir für die aktuelle Priorität einen Treffer haben, nehmen wir diesen und hören auf zu suchen.
    if (nutrientItem) {
      // USDA API Inkonsistenz beheben:
      // Manchmal heißt es "amount", manchmal "value".
      const val = typeof nutrientItem.amount === 'number' ? nutrientItem.amount : nutrientItem.value;
      return val ? Math.round(val * 100) / 100 : 0;
    }
  }
  
  return 0;
};

/**
 * Generiert den "Visual Parent" String für die KI-Bildgenerierung.
 * Heuristik: Nimmt den ersten Teil des Namens vor dem ersten Komma.
 * Beispiel: "Apples, raw, fuji" -> "apples"
 */
const generateVisualParent = (description: string): string => {
  if (!description) return 'food';
  
  // 1. Am Komma splitten und ersten Teil nehmen
  let parent = description.split(',')[0];
  
  // 2. Bereinigen (Trimmen, Kleinschreibung)
  parent = parent.trim().toLowerCase();
  
  // 3. Optional: Singularisierung könnte hier später ergänzt werden
  // (z.B. "apples" -> "apple"), aber für die Bild-KI ist "apples" auch okay.
  
  return parent;
};

/**
 * Normalizes a single portion entry.
 * Prioritizes portionDescription -> modifier (SR Legacy) -> measureUnit.name -> 'Einheit'
 */
const normalizeFoodPortion = (p: FoodPortion): NormalizedFoodPortion => {
  const unitDescription = p.portionDescription || p.modifier || p.measureUnit?.name || 'Einheit';
  
  return {
    id: p.id,
    amount: p.amount,
    gramWeight: p.gramWeight,
    unitDescription: unitDescription
  };
};

/**
 * Hauptfunktion zur Normalisierung
 * Wandelt das komplexe USDA Format in ein flaches, nutzbares Objekt um.
 */
export const normalizeFoodItem = (food: FDCFoodItem): NormalizedFood => {
  return {
    fdcId: food.fdcId,
    description: food.description,
    dataType: food.dataType,
    publicationDate: food.publicationDate,
    
    // PRIORITÄT: 
    // 1. Standard Kalorien (1008)
    // 2. Atwater Specific (2048) -> Genauer als General!
    // 3. Atwater General (2047) -> Fallback
    energy_kcal: getValue(food, [NUTRIENT_IDS.ENERGY_KCAL, NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC, NUTRIENT_IDS.ENERGY_ATWATER_GENERAL]),
    
    protein_g: getValue(food, NUTRIENT_IDS.PROTEIN),
    fat_g: getValue(food, NUTRIENT_IDS.TOTAL_LIPID_FAT),
    carbs_g: getValue(food, NUTRIENT_IDS.CARBOHYDRATE_BY_DIFF),
    sugar_g: getValue(food, NUTRIENT_IDS.SUGARS_TOTAL),
    fiber_g: getValue(food, NUTRIENT_IDS.FIBER_TOTAL_DIETARY),
    sodium_mg: getValue(food, NUTRIENT_IDS.SODIUM),
    
    visual_parent: generateVisualParent(food.description),
    
    // Category Mapping
    category: food.foodCategory?.description || 'Unknown',
    category_code: food.foodCategory?.code || '',
    
    // Portion Mapping
    portions: (food.foodPortions || []).map(normalizeFoodPortion),
    
    // Pass through list for detailed view
    foodNutrients: food.foodNutrients || []
  };
};

/**
 * Normalizes the raw row returned by the 'get_tiles_food_details' RPC.
 * Maps JSON array structures to the application's NormalizedFood format.
 */
export const normalizeTilesFoodDetailsRow = (row: any): NormalizedFood => {
  // Use primary_label if available, otherwise fallback to canonical_name
  const description = row.primary_label || row.canonical_name || 'Unknown Food';
  
  // Build NormalizedFoodNutrients from the JSON list
  const rawNutrients = Array.isArray(row.nutrients) ? row.nutrients : [];
  
  const foodNutrients = rawNutrients.map((n: any) => ({
    id: 0, // Not strictly needed for UI display
    nutrientId: n.nutrientNumber ? parseInt(n.nutrientNumber) : 0,
    nutrientNumber: n.nutrientNumber,
    nutrientName: n.nutrientName,
    unitName: n.unitName,
    value: n.amount,
    amount: n.amount,
    nutrient: { // Populate nested object for compatibility with some helpers if needed
       id: n.nutrientNumber ? parseInt(n.nutrientNumber) : 0,
       number: n.nutrientNumber,
       name: n.nutrientName,
       rank: 0,
       unitName: n.unitName
    }
  }));

  // Helper to extract value from our new list by nutrientNumber (string) or ID
  const getVal = (num: number) => {
    // We try to find by string number first (e.g. "203")
    // Mapping from constants (ID -> Number)
    // 1008 -> 208 (Energy)
    // 1003 -> 203 (Protein)
    // 1004 -> 204 (Fat)
    // 1005 -> 205 (Carbs)
    // 2000 -> 269 (Sugars)
    // 1079 -> 291 (Fiber)
    // 1093 -> 307 (Sodium)
    // 2047 -> 957 (Atwater General)
    // 2048 -> 958 (Atwater Specific)

    const mapIdToNumber: Record<number, string> = {
      1008: '208',
      1003: '203',
      1004: '204',
      1005: '205',
      2000: '269',
      1079: '291',
      1093: '307',
      2047: '957',
      2048: '958'
    };
    
    const targetNum = mapIdToNumber[num];
    if (targetNum) {
      const found = foodNutrients.find((n: any) => n.nutrientNumber === targetNum);
      if (found) return found.amount || 0;
    }
    
    // Fallback search by ID if parser worked
    const foundById = foodNutrients.find((n: any) => n.nutrientId === num);
    if (foundById) return foundById.amount || 0;

    return 0;
  };

  const portions = (Array.isArray(row.portions) ? row.portions : []).map((p: any) => ({
    id: p.portionId || 0,
    amount: p.amount || 0,
    gramWeight: p.gramWeight || 0,
    unitDescription: p.portionDescription || p.measureUnitName || p.modifier || 'portion'
  }));

  // Energy Calculation logic similar to normalizeFoodItem
  // We prioritize Atwater Specific (958) -> General (957) -> Standard (208)
  let energy = getVal(NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC);
  if (!energy) energy = getVal(NUTRIENT_IDS.ENERGY_ATWATER_GENERAL);
  if (!energy) energy = getVal(NUTRIENT_IDS.ENERGY_KCAL);

  return {
    fdcId: row.default_fdc_id,
    description: description,
    dataType: row.usda_data_type || row.default_dataset || 'TilesDB',
    publicationDate: '', // Not provided by RPC currently
    
    energy_kcal: energy,
    protein_g: getVal(NUTRIENT_IDS.PROTEIN),
    fat_g: getVal(NUTRIENT_IDS.TOTAL_LIPID_FAT),
    carbs_g: getVal(NUTRIENT_IDS.CARBOHYDRATE_BY_DIFF),
    sugar_g: getVal(NUTRIENT_IDS.SUGARS_TOTAL),
    fiber_g: getVal(NUTRIENT_IDS.FIBER_TOTAL_DIETARY),
    sodium_mg: getVal(NUTRIENT_IDS.SODIUM),
    
    visual_parent: row.canonical_name || generateVisualParent(description),
    category: row.food_category || '',
    category_code: '',
    
    portions: portions,
    foodNutrients: foodNutrients
  };
};