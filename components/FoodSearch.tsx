import React, { useState, useEffect } from 'react';
import { Search, Loader2, Info, Database, ChevronRight, Calculator, FlaskConical } from 'lucide-react';
import { usdaService } from '../services/usdaService';
import { SearchResultFood, DataType } from '../types';
import { NUTRIENT_IDS } from '../constants';
import { Link } from 'react-router-dom';

const STORAGE_KEY_SEARCH = 'TILES_SEARCH_STATE';

export const FoodSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<SearchResultFood[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [retryStatus, setRetryStatus] = useState("");

  // Restore State on Mount
  useEffect(() => {
    const savedState = sessionStorage.getItem(STORAGE_KEY_SEARCH);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setQuery(parsed.query || '');
        setResults(parsed.results || []);
        setHasSearched(parsed.hasSearched || false);
      } catch (e) {
        console.error('Failed to restore search state', e);
      }
    }
  }, []);

  // Centralized Search Execution
  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setRetryStatus("");
    
    try {
      const response = await usdaService.searchFoods(searchTerm, (attempt) => {
        setRetryStatus(`Retry ${attempt}/3…`);
      });
      
      // Safeguard against undefined response.foods
      const foodResults = response?.foods || [];
      setResults(foodResults);
      
      console.log("[FoodSearch] Search results:", foodResults);

      sessionStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify({
        query: searchTerm,
        results: foodResults,
        hasSearched: true
      }));
      
    } catch (err) {
      console.error("[FoodSearch] Search error:", err);
      // Soft fail: Just show error, clear results to avoid misleading stale data
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setResults([]); 
    } finally {
      setIsLoading(false);
      setRetryStatus("");
    }
  };

  // Debounced Search Effect (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Only execute if query is valid
      if (query.trim()) {
        executeSearch(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle Manual Submit (Immediate)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
       executeSearch(query);
    }
  };

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
        <form onSubmit={handleManualSubmit} className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g., 'Avocado', 'Raw Spinach'..."
            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-lg"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
          
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-3">
             {isLoading ? (
               <div className="bg-gray-100 px-4 py-2 rounded-lg flex items-center">
                 <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                 <span className="ml-2 text-sm text-gray-500 font-medium">Searching...</span>
               </div>
             ) : (
               <button
                type="submit"
                disabled={!query.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Search
              </button>
             )}
          </div>
        </form>
        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span className="flex items-center"><Database className="w-3 h-3 mr-1" /> Sources: Foundation, SR Legacy</span>
          {retryStatus && (
            <span className="text-orange-500 font-medium animate-pulse">{retryStatus}</span>
          )}
        </div>
      </div>

      {/* Soft Fail / Error State */}
      {error && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 rounded-xl flex items-center shadow-sm animate-fade-in">
          <Info className="w-5 h-5 mr-3 flex-shrink-0 text-orange-500" />
          <div className="flex-1">
            <span className="font-medium">Search encountered an issue:</span> {error}
          </div>
        </div>
      )}

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((food) => (
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
      {!isLoading && hasSearched && results.length === 0 && !error && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No ingredients found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your search terms or spelling.</p>
        </div>
      )}
    </div>
  );
};
