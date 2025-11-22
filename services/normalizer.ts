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
 * Prioritizes portionDescription -> measureUnit.name -> 'Einheit'
 */
const normalizeFoodPortion = (p: FoodPortion): NormalizedFoodPortion => {
  const unitDescription = p.portionDescription || p.measureUnit?.name || 'Einheit';
  
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