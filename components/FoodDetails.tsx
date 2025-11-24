import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag, BarChart3, FlaskConical, Gauge, Calculator, Utensils, Zap, Database } from 'lucide-react';
import { usdaService } from '../services/usdaService';
import { NormalizedFood, NormalizedFoodNutrient } from '../types';
import { NUTRIENT_ORDER, NUTRIENT_DISPLAY_NAMES } from '../constants';

export const FoodDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [food, setFood] = useState<NormalizedFood | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState("");

  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      setIsLoading(true);
      setError(null);
      setRetryStatus("");

      try {
        const data = await usdaService.getFoodDetails(Number(id), (attempt) => {
           setRetryStatus(`Retry ${attempt}/3…`);
        });
        
        console.log("[FoodDetails] Loaded details:", data);
        setFood(data);
      } catch (err) {
        console.error("[FoodDetails] Detail error:", err);
        setError(err instanceof Error ? err.message : 'Failed to load food details');
      } finally {
        setIsLoading(false);
        setRetryStatus("");
      }
    };

    fetchDetails();
  }, [id]);

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        <p className="mt-4 text-gray-500 font-medium">Loading nutritional data...</p>
        {retryStatus && (
          <p className="text-xs text-gray-400 mt-2 animate-pulse">{retryStatus}</p>
        )}
      </div>
    );
  }

  if (error || !food) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-50 border border-red-200 rounded-xl text-center">
        <h2 className="text-lg font-bold text-red-800 mb-2">Error Loading Data</h2>
        <p className="text-red-600 mb-6">{error || 'Food not found'}</p>
        <Link to="/ingredients" className="text-red-700 font-medium hover:underline flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Search
        </Link>
      </div>
    );
  }

  // Sort nutrients for the detailed table
  const sortedNutrients = (food.foodNutrients || [])
    .filter(n => {
      const nid = n.nutrient?.id || n.nutrientId;
      // Filter out nutrients without values
      const val = typeof n.amount === 'number' ? n.amount : n.value;
      return nid && (val !== undefined && val !== null);
    })
    .sort((a, b) => {
      const idA = a.nutrient?.id || a.nutrientId || 0;
      const idB = b.nutrient?.id || b.nutrientId || 0;
      const indexA = NUTRIENT_ORDER.indexOf(idA);
      const indexB = NUTRIENT_ORDER.indexOf(idB);
      
      // If both are in the priority list, sort by index
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      // If one is in the list, it comes first
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      // Otherwise sort alphabetical by name
      const nameA = a.nutrient?.name || a.nutrientName || '';
      const nameB = b.nutrient?.name || b.nutrientName || '';
      return nameA.localeCompare(nameB);
    });

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <Link to="/ingredients" className="inline-flex items-center text-gray-500 hover:text-emerald-600 mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Search
            </Link>
            <div className="flex items-center gap-2 mb-2">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                food.dataType === 'Foundation' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {food.dataType}
              </span>
              <span className="text-xs text-gray-400 font-mono">FDC ID: {food.fdcId}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-2">
              {food.description}
            </h1>
            <div className="flex items-center text-sm text-gray-500">
              <Tag className="w-4 h-4 mr-2" />
              Category: <span className="font-medium text-gray-700 ml-1">{food.category}</span>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-xl p-4 flex items-center shadow-inner">
             <div className="text-center px-4 border-r border-gray-200">
               <span className="block text-2xl font-bold text-emerald-600">{food.energy_kcal}</span>
               <span className="text-xs text-gray-500 uppercase tracking-wide">Calories</span>
             </div>
             <div className="px-4">
                <div className="text-xs text-gray-400 mb-1">Per 100g serving</div>
                <div className="flex items-center text-xs text-emerald-700 font-medium bg-emerald-100 px-2 py-0.5 rounded-full w-max">
                  <Database className="w-3 h-3 mr-1" />
                  USDA Verified
                </div>
             </div>
          </div>
        </div>

        {/* Macros Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <MacroCard 
            label="Protein" 
            value={food.protein_g} 
            unit="g" 
            icon={Utensils} 
            color="blue" 
            percent={0} 
          />
          <MacroCard 
            label="Total Fat" 
            value={food.fat_g} 
            unit="g" 
            icon={Zap} 
            color="yellow" 
            percent={0} 
          />
          <MacroCard 
            label="Carbs" 
            value={food.carbs_g} 
            unit="g" 
            icon={BarChart3} 
            color="purple" 
            percent={0} 
          />
           <MacroCard 
            label="Fiber" 
            value={food.fiber_g} 
            unit="g" 
            icon={Gauge} 
            color="green" 
            percent={0} 
          />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Detailed Nutrients */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900 flex items-center">
                <FlaskConical className="w-5 h-5 mr-2 text-gray-500" />
                Nutrient Breakdown
              </h3>
              <span className="text-xs text-gray-500">Values per 100g</span>
            </div>
            
            <div className="divide-y divide-gray-50">
              {sortedNutrients.length > 0 ? (
                sortedNutrients.map((n, idx) => {
                  const nid = n.nutrient?.id || n.nutrientId || 0;
                  const name = n.nutrient?.name || n.nutrientName || 'Unknown';
                  const unit = n.nutrient?.unitName || n.unitName || '';
                  const val = typeof n.amount === 'number' ? n.amount : (n.value || 0);
                  const isKeyNutrient = NUTRIENT_ORDER.includes(nid);

                  return (
                    <div key={idx} className={`px-6 py-3 flex justify-between items-center hover:bg-gray-50 transition-colors ${isKeyNutrient ? 'bg-gray-[10px]' : ''}`}>
                      <span className={`text-sm ${isKeyNutrient ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                        {name}
                      </span>
                      <span className="font-mono text-sm text-gray-700">
                        {val} <span className="text-gray-400 text-xs ml-0.5">{unit.toLowerCase()}</span>
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">No detailed nutrient data available.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Info & Portions */}
        <div className="space-y-6">
           {/* Portions Card */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
               <h3 className="font-bold text-gray-900 flex items-center">
                 <Calculator className="w-5 h-5 mr-2 text-gray-500" />
                 Common Portions
               </h3>
             </div>
             <div className="p-2">
                {food.portions && food.portions.length > 0 ? (
                  <div className="space-y-1">
                    {food.portions.map(p => (
                      <div key={p.id} className="p-3 hover:bg-emerald-50 rounded-lg flex justify-between items-center transition-colors cursor-default group">
                        <span className="text-sm text-gray-700 group-hover:text-emerald-800">
                          {p.amount} {p.unitDescription}
                        </span>
                        <span className="text-xs font-mono text-gray-400 group-hover:text-emerald-600">
                          {p.gramWeight}g
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-sm text-gray-400">
                    No portion data available. Standard 100g used.
                  </div>
                )}
             </div>
           </div>

           {/* Tech Specs */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
             <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">Data Source Information</h4>
             <div className="space-y-3 text-sm">
               <div className="flex justify-between">
                 <span className="text-gray-500">Published</span>
                 <span className="text-gray-900">{food.publicationDate}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-gray-500">Visual Parent</span>
                 <span className="text-gray-900 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{food.visual_parent}</span>
               </div>
               <div className="flex justify-between">
                 <span className="text-gray-500">Category Code</span>
                 <span className="text-gray-900">{food.category_code}</span>
               </div>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// Helper Component for Macro Cards
const MacroCard = ({ label, value, unit, icon: Icon, color }: any) => {
  const colorStyles: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-emerald-50 text-emerald-600 border-emerald-100",
    yellow: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };

  const activeStyle = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`rounded-xl border p-4 ${activeStyle} flex flex-col justify-between h-full`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
        <Icon className="w-4 h-4 opacity-70" />
      </div>
      <div>
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs ml-1 font-medium opacity-70">{unit}</span>
      </div>
    </div>
  );
};
