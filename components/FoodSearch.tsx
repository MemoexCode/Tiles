import React, { useState } from 'react';
import { Search, Loader2, Info, Database, ChevronRight, Calculator, FlaskConical } from 'lucide-react';
import { searchTilesFood } from '../services/tilesFoodSearchService';
import { TilesFoodSearchResult } from '../types';
import { Link } from 'react-router-dom';

const STORAGE_KEY_SEARCH = 'TILES_SEARCH_STATE';

/**
 * FoodSearch Component
 * 
 * Features:
 * - Manual Search Only (Enter key or Button)
 * - Persistent Results across navigation
 * - Uses Supabase RPC 'search_tiles_food' instead of direct FDC API
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
  const [cachedResults, setCachedResults] = useState<TilesFoodSearchResult[]>(initialState.results);
  const [hasSearched, setHasSearched] = useState<boolean>(initialState.hasSearched);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const executeSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;

    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    
    try {
      // Use 'de' to ensure we get German labels if available, aligning with the new default RPC behavior.
      const results = await searchTilesFood({ query: searchTerm, langCode: 'de' });
      
      setCachedResults(results);
      
      console.log("[FoodSearch] Search results:", results);

      // Persist to storage
      sessionStorage.setItem(STORAGE_KEY_SEARCH, JSON.stringify({
        query: searchTerm,
        results: results,
        hasSearched: true
      }));
      
    } catch (err) {
      console.error("[FoodSearch] Search error:", err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setCachedResults([]);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ingredient Search</h1>
          <p className="text-gray-500 mt-1">Search the curated Tiles food database.</p>
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
            placeholder="Search e.g., 'Apfel', 'Banane'..."
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
             <span className="flex items-center"><Database className="w-3 h-3 mr-1" /> Sources: Tiles Index (Supabase)</span>
           </div>
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
        {cachedResults.map((item) => (
          <div 
            key={item.foodId} 
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all group flex flex-col h-full"
          >
            <div className="p-5 flex-1">
              <div className="flex justify-between items-start mb-2">
                {item.usdaDataType && (
                  <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700`}>
                    {item.usdaDataType}
                  </span>
                )}
                <span className="text-xs text-gray-400">#{item.defaultFdcId || 'N/A'}</span>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg leading-tight mb-1 group-hover:text-emerald-600 transition-colors">
                {item.primaryLabel}
              </h3>
              
              {item.foodCategory && (
                <p className="text-xs text-gray-500 mt-1">{item.foodCategory}</p>
              )}

              {/* Nutrients are not returned by the RPC search index, so we show a placeholder message or nothing */}
              <div className="mt-4 text-xs text-gray-400 italic">
                Detailed nutrients available in view.
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <span className="text-xs text-gray-500">
                {item.defaultDataset || 'USDA'}
              </span>
              
              {/* Prioritize linking via UUID (foodId). Pass fallback info via state. */}
              {item.foodId ? (
                <Link 
                  to={`/food/${item.foodId}`}
                  state={{ 
                    fallbackFdcId: item.defaultFdcId, 
                    fallbackDataset: item.defaultDataset, 
                    fallbackLabel: item.primaryLabel 
                  }}
                  className="text-sm font-medium text-emerald-600 flex items-center hover:text-emerald-700"
                >
                  View Details <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              ) : (
                 <span className="text-sm text-gray-400 cursor-not-allowed">No ID</span>
              )}
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
      {isLoading && (
         <div className="text-center py-20 opacity-50">
           <Loader2 className="w-10 h-10 animate-spin mx-auto text-emerald-500 mb-4" />
           <p className="text-gray-500">Searching Tiles database...</p>
         </div>
      )}
    </div>
  );
};