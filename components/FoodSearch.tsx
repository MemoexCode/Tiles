import React, { useState, useEffect } from 'react';
import { Search, Loader2, Info, Database, ChevronRight, Calculator, FlaskConical } from 'lucide-react';
import { usdaService } from '../services/usdaService';
import { SearchResultFood, DataType } from '../types';
import { NUTRIENT_IDS } from '../constants';
import { Link } from 'react-router-dom';

const STORAGE_KEY_SEARCH = 'TILES_SEARCH_STATE';

/**
 * FoodSearch Component
 * 
 * Features:
 * - Manual Search Only (Enter key or Button)
 * - Persistent Results across navigation
 * - Retry UI Integration
 * - Soft Failure States
 */
export const FoodSearch: React.FC = () => {
  // Initialize state from session storage to persist across navigation
  const getInitialState = () => {
    const savedState = sessionStorage.getItem(STORAGE_KEY_SEARCH);
    if (savedState) {
      try {
        return JSON.parse(savedState);
      } catch (e) {
        console.error('Failed to parse search state', e);
      }
    }
    return { query: '', results: [], hasSearched: false };
  };

  const initialState = getInitialState();

  const [query, setQuery] = useState<string>(initialState.query);
  const [cachedResults, setCachedResults] = useState<SearchResultFood[]>(initialState.results);
  const [hasSearched, setHasSearched] = useState<boolean>(initialState.hasSearched);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState("");
  
  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setRetryStatus("");
    
    try {
      const response = await usdaService.searchFoods(searchTerm);
      
      const foodResults = response?.foods || [];
      setCachedResults(foodResults);
      
      console.log("[FoodSearch] Search results:", foodResults);

      // Persist to storage
      sessionStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify({
        query: searchTerm,
        results: foodResults,
        hasSearched: true
      }));
      
    } catch (err) {
      console.error("[FoodSearch] Search error:", err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      // We do not clear cachedResults on error to allow user to see previous state if desired,
      // or we can clear it if that's preferred. Given "Persist" instructions, we keep them unless a new valid search replaces them.
      // However, if the user explicitly searched and it failed, showing old results might be confusing.
      // But the prompt says "Results persist until: The user presses Enter with a new search term."
      // We'll reset results only if the search was intended to replace them.
      setCachedResults([]);
    } finally {
      setIsLoading(false);
      setRetryStatus("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); 
      executeSearch(query);
    }
  };

  const handleSearchClick = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(query);
  };

  // Helper to get nutrient values safely
  const getNutrientValue = (food: SearchResultFood, nutrientId: number): number | null => {
    if (!food.foodNutrients) return null;
    const nutrient = food.foodNutrients.find(n => n.nutrientId === nutrientId);
    if (nutrient && (typeof nutrient.value === 'number')) {
      return Math.round(nutrient.value);
    }
    return null;
  };

  const renderCalorieValue = (food: SearchResultFood) => {
    const valStandard = getNutrientValue(food, NUTRIENT_IDS.ENERGY_KCAL);
    if (valStandard !== null) return <span>{valStandard}</span>;

    const valSpecific = getNutrientValue(food, NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC);
    if (valSpecific !== null) return (
      <span className="flex items-center justify-center text-purple-700 font-bold">
        {valSpecific} <FlaskConical className="w-3 h-3 ml-1 fill-purple-100 text-purple-500" />
      </span>
    );

    const valGeneral = getNutrientValue(food, NUTRIENT_IDS.ENERGY_ATWATER_GENERAL);
    if (valGeneral !== null) return (
      <span className="flex items-center justify-center text-gray-500">
        {valGeneral} <Calculator className="w-3 h-3 ml-1 text-gray-400" />
      </span>
    );
             
    return '-';
  };

  const renderValueOrDash = (val: number | null) => {
    return val !== null ? val : '-';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Search</h1>
          <p className="text-gray-500 mt-1">Search the USDA FoodData Central database via Secure Proxy.</p>
        </div>
      </div>

      {/* Search Input Card */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <form onSubmit={handleSearchClick} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search e.g., 'Avocado', 'Raw Spinach'..."
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-lg"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
          </button>
        </form>
        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between">
           <div className="flex items-center text-xs text-gray-400 space-x-4 mb-2 md:mb-0">
             <span className="flex items-center"><Database className="w-3 h-3 mr-1" /> Sources: Foundation, SR Legacy</span>
           </div>
           {retryStatus && (
              <p className="text-xs text-gray-500 animate-pulse">{retryStatus}</p>
           )}
        </div>
      </div>

      {/* Error State - Soft Fail */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start">
          <Info className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-medium">Search Issue</h3>
            <p className="text-sm mt-1">{error}</p>
            <p className="text-xs mt-2 text-red-500">Please try a different term or check your connection.</p>
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cachedResults.map((food) => (
          <div 
            key={food.fdcId} 
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group flex flex-col h-full"
          >
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-2">
                <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                  food.dataType === DataType.Foundation 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-blue-50 text-blue-700'
                }`}>
                  {food.dataType}
                </span>
                <span className="text-xs text-gray-400">#{food.fdcId}</span>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 group-hover:text-emerald-600 transition-colors">
                {food.description}
              </h3>

              <div className="grid grid-cols-3 gap-2 mt-6">
                {/* Quick Stats */}
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                   <div className="text-xs text-gray-500 mb-0.5">Calories</div>
                   <div className="font-bold text-gray-900">
                     {renderCalorieValue(food)}
                   </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                   <div className="text-xs text-gray-500 mb-0.5">Protein</div>
                   <div className="font-bold text-gray-900">
                     {renderValueOrDash(getNutrientValue(food, NUTRIENT_IDS.PROTEIN))}<span className="text-[10px] font-normal text-gray-500">g</span>
                   </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                   <div className="text-xs text-gray-500 mb-0.5">Fat</div>
                   <div className="font-bold text-gray-900">
                     {renderValueOrDash(getNutrientValue(food, NUTRIENT_IDS.TOTAL_LIPID_FAT))}<span className="text-[10px] font-normal text-gray-500">g</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">Per 100g</span>
              <Link 
                to={`/food/${food.fdcId}`} 
                className="text-sm font-medium text-emerald-600 flex items-center hover:text-emerald-700"
              >
                View Details <ChevronRight className="w-4 h-4 ml-1" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!isLoading && hasSearched && cachedResults.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No ingredients found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search terms.</p>
        </div>
      )}
      
      {/* Loading Skeleton during active search */}
      {isLoading && cachedResults.length === 0 && (
         <div className="text-center py-20 opacity-50">
           <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500 mb-4" />
           <p className="text-gray-500">Searching database...</p>
         </div>
      )}
    </div>
  );
};