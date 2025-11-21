import { FoodNutrient } from '../types';

export const extractNutrient = (n: FoodNutrient) => {
  const id = n.nutrient?.id || n.nutrientId;
  const name = n.nutrient?.name || n.nutrientName || 'Unknown Nutrient';
  const unit = n.nutrient?.unitName || n.unitName || '';
  const val = typeof n.amount === 'number' ? n.amount : (n.value || 0);
  return { id, name, unit, val };
};