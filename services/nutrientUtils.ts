import { FoodNutrient } from '../types';
import { NUTRIENT_DISPLAY_NAMES, NUTRIENT_IDS } from '../constants';

export const extractNutrient = (n: FoodNutrient) => {
  const id = n.nutrient?.id || n.nutrientId;
  const name = n.nutrient?.name || n.nutrientName || 'Unknown Nutrient';
  const unit = n.nutrient?.unitName || n.unitName || '';
  const val = typeof n.amount === 'number' ? n.amount : (n.value || 0);
  return { id, name, unit, val };
};

/**
 * Finds a specific nutrient value in a normalized food object or raw nutrient list.
 * Uses ID matching to find the value.
 */
export const getNutrientValue = (food: any, nutrientId: number): number | null => {
    // Check Normalized structure first (if available and matches key)
    // Note: This simple check assumes keys match IDs which isn't fully true for normalized object keys (protein_g vs 1003).
    // So we rely on the raw list generally for specific IDs unless we map them.
    
    const list = food.foodNutrients || [];
    const nutrient = list.find((n: FoodNutrient) => {
        const nid = n.nutrient?.id || n.nutrientId;
        return nid === nutrientId;
    });

    if (nutrient) {
        const val = typeof nutrient.amount === 'number' ? nutrient.amount : nutrient.value;
        // Return number if valid, else null
        return (val !== undefined && val !== null) ? val : null;
    }
    
    return null;
};

/**
 * Returns display info (Name, Unit) for a given nutrient ID.
 */
export const getNutrientInfo = (nutrientId: number) => {
    return {
        name: NUTRIENT_DISPLAY_NAMES[nutrientId] || 'Unknown',
        // Unit is harder to guess without data, but for known ones we could map it. 
        // For now, we rely on the API data for units usually.
        // This helper is mostly for names.
    };
};

/**
 * Renders a value or a dash if null/undefined.
 */
export const renderValueOrDash = (val: number | null | undefined) => {
    if (val === null || val === undefined) return '-';
    // Optional: Round to reasonable decimals
    return Math.round(val * 100) / 100;
};