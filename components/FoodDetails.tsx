import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Database, Loader2, Tag, Scale, Info, BrainCircuit, ScanEye } from 'lucide-react';
import { usdaService } from '../services/usdaService';
import { normalizeFoodItem, NormalizedFood } from '../services/normalizer';
import { FDCFoodItem, FoodNutrient } from '../types';
import { NUTRIENT_DISPLAY_NAMES, NUTRIENT_IDS } from '../constants';

export const FoodDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [food, setFood] = useState<FDCFoodItem | null>(null);
  const [normalizedView, setNormalizedView] = useState<NormalizedFood | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch Raw Data
        const data = await usdaService.getFoodDetails(parseInt(id));
        setFood(data);
        
        // Calculate normalization locally for display (mimics backend logic)
        const normalized = normalizeFoodItem(data);
        setNormalizedView(normalized);
        
      } catch (err) {
        console.error(err);
        setError('Failed to load food details. Please check your API key or connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [id]);

  // Helper to safely extract displayable data from inconsistent USDA structures
  const getNutrientDisplayInfo = (n: FoodNutrient) => {
    // ID: Prioritize nested nutrient.id (Foundation), fallback to nutrientId (SR Legacy/Search)
    const id = n.nutrient?.id || n.nutrientId;
    
    // Name: Prioritize nested nutrient.name, fallback to flat nutrientName
    let name = n.nutrient?.name || n.nutrientName || 'Unknown Nutrient';
    
    // Unit: Prioritize nested unitName, fallback to flat unitName
    const unit = n.nutrient?.unitName || n.unitName || '';
    
    // Value: 'amount' is standard for details, 'value' for search results
    const val = typeof n.amount === 'number' ? n.amount : (n.value || 0);

    return { id, name, unit, val };
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
        <p className="text-gray-500">Checking database & fetching details...</p>
      </div>
    );
  }

  if (error || !food) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-xl text-center">
        <Info className="w-8 h-8 mx-auto mb-2" />
        <h3 className="font-bold text-lg">Error Loading Data</h3>
        <p className="mb-4">{error || 'Food not found'}</p>
        <Link to="/ingredients" className="text-sm font-medium underline hover:text-red-800">
          Back to Search
        </Link>
      </div>
    );
  }

  // Pre-calculate if the standard Energy ID (1008) is present
  const hasStandardEnergy = food.foodNutrients.some(n => {
    const nid = n.nutrient?.id || n.nutrientId;
    return nid === NUTRIENT_IDS.ENERGY_KCAL;
  });

  // Pre-calculate if Specific Energy ID (2048) is present (Better than General 2047)
  const hasSpecificEnergy = food.foodNutrients.some(n => {
    const nid = n.nutrient?.id || n.nutrientId;
    return nid === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC;
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Navigation */}
      <Link to="/ingredients" className="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Search
      </Link>

      {/* Title Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                food.dataType === 'Foundation' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {food.dataType}
              </span>
              <span className="text-xs text-gray-400 flex items-center">
                <Database className="w-3 h-3 mr-1" /> ID: {food.fdcId}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{food.description}</h1>
            {food.brandOwner && (
              <p className="text-gray-500 mt-1">Brand: {food.brandOwner}</p>
            )}
          </div>
        </div>

        {/* KI / AI Info Section */}
        {normalizedView && (
          <div className="mt-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-full text-indigo-600 self-start sm:self-center">
               <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-1">
                AI Image Strategy
              </p>
              <p className="text-sm text-indigo-900">
                Identified Visual Parent: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-indigo-200 ml-1">"{normalizedView.visual_parent}"</strong>
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                This grouping prevents duplicate image generation for similar food items.
              </p>
            </div>
          </div>
        )}

        {/* Ingredients List (if available) */}
        {food.ingredients && (
          <div className="mt-6 p-4 bg-gray-50 rounded-xl text-sm text-gray-600 leading-relaxed border border-gray-100">
            <span className="font-semibold text-gray-900 block mb-1">Ingredients:</span>
            {food.ingredients}
          </div>
        )}
      </div>

      {/* Nutrients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Macros Card */}
        <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="font-bold text-lg text-gray-900 mb-4 flex items-center">
            <Scale className="w-5 h-5 mr-2 text-emerald-600" />
            Nutritional Values
            <span className="ml-2 text-xs font-normal text-gray-400">(Per 100g)</span>
          </h2>
          
          <div className="space-y-0 divide-y divide-gray-100">
            {food.foodNutrients
              .map(n => getNutrientDisplayInfo(n)) // 1. Extract info
              .filter(info => info.val > 0 && info.id) // 2. Filter empty/invalid
              .sort((a, b) => {
                  // 3. Sort: Known/Important nutrients first
                  const aKnown = NUTRIENT_DISPLAY_NAMES[a.id!] ? 1 : 0;
                  const bKnown = NUTRIENT_DISPLAY_NAMES[b.id!] ? 1 : 0;
                  return bKnown - aKnown;
              })
              .map((info, index) => {
                // 4. Display Logic
                let displayName = (info.id && NUTRIENT_DISPLAY_NAMES[info.id]) || info.name;
                const isHighlight = info.id && !!NUTRIENT_DISPLAY_NAMES[info.id];
                
                // STRICT FILTER LOGIC:
                
                // Scenario 1: Standard Energy (1008) exists.
                // -> Hide Atwater General (2047) and Specific (2048) to prevent duplicates.
                if (hasStandardEnergy) {
                  if (info.id === NUTRIENT_IDS.ENERGY_ATWATER_GENERAL || info.id === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC) {
                    return null;
                  }
                }

                // Scenario 2: No Standard Energy, but we have Specific Energy (2048).
                // -> Hide Atwater General (2047) because Specific is better.
                if (!hasStandardEnergy && hasSpecificEnergy) {
                   if (info.id === NUTRIENT_IDS.ENERGY_ATWATER_GENERAL) {
                     return null;
                   }
                }

                return (
                  <div key={`${info.id}-${index}`} className="flex justify-between items-center py-3 hover:bg-gray-50 px-2 -mx-2 rounded transition-colors">
                    <span className={`${isHighlight ? 'font-medium text-gray-900' : 'text-gray-600 text-sm'}`}>
                      {displayName}
                    </span>
                    <span className="font-mono text-gray-700">
                      {info.val} <span className="text-gray-400 text-xs">{info.unit?.toLowerCase() || ''}</span>
                    </span>
                  </div>
                );
            })}
          </div>
        </div>

        {/* Meta Info Card */}
        <div className="space-y-6">
          {normalizedView && (
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
               <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                 <ScanEye className="w-4 h-4 mr-2 text-gray-400" /> Normalized Data
               </h3>
               <p className="text-xs text-gray-400 mb-3">
                 Standardized values calculated for meal planning.
               </p>
               <div className="text-sm space-y-2">
                 <div className="flex justify-between">
                   <span className="text-gray-600">Calories</span>
                   <span className="font-medium">{normalizedView.energy_kcal}</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-600">Protein</span>
                   <span className="font-medium">{normalizedView.protein_g}g</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-600">Fat</span>
                   <span className="font-medium">{normalizedView.fat_g}g</span>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-gray-600">Carbs</span>
                   <span className="font-medium">{normalizedView.carbs_g}g</span>
                 </div>
               </div>
            </div>
          )}
        
          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
             <h3 className="font-bold text-emerald-900 mb-2">Data Source</h3>
             <p className="text-sm text-emerald-700 mb-4">
               This data is sourced from USDA FoodData Central and cached in your private database.
             </p>
             <div className="text-xs text-emerald-600">
               Published: {food.publicationDate}
             </div>
          </div>
          
          {food.foodPortions && food.foodPortions.length > 0 && (
             <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                  <Tag className="w-4 h-4 mr-2 text-gray-400" /> Portions
                </h3>
                <ul className="space-y-2">
                  {food.foodPortions.map((portion) => (
                    <li key={portion.id} className="text-sm text-gray-600 flex justify-between">
                      <span>{portion.amount} {portion.modifier}</span>
                      <span className="font-mono text-gray-400">{portion.gramWeight}g</span>
                    </li>
                  ))}
                </ul>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};