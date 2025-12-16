import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Tag, BarChart3, FlaskConical, Gauge, Calculator, Utensils, Zap, Database, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

import { getNutrientValue, getNutrientInfo, renderValueOrDash } from '../services/nutrientUtils';
import { usdaService } from '../services/usdaService';
import { getTilesFoodDetails } from '../services/tilesFoodDetailsService';
import { normalizeTilesFoodDetailsRow, normalizeFoodItem } from '../services/normalizer';
import { NormalizedFood, NormalizedFoodNutrient, DatabaseStatus } from '../types';
import { NUTRIENT_IDS, NUTRIENT_DISPLAY_NAMES, NUTRIENT_ORDER } from '../constants';

// Helper for sorting based on the constants.ts order
const sortNutrients = (a: NormalizedFoodNutrient, b: NormalizedFoodNutrient): number => {
    const idA = a.nutrient?.id || a.nutrientId || 0;
    const idB = b.nutrient?.id || b.nutrientId || 0;

    const orderA = NUTRIENT_ORDER.indexOf(idA);
    const orderB = NUTRIENT_ORDER.indexOf(idB);

    // If both are recognized (have an order), sort by that order
    if (orderA !== -1 && orderB !== -1) {
        return orderA - orderB;
    }
    // If only A is recognized, A comes first
    if (orderA !== -1) {
        return -1;
    }
    // If only B is recognized, B comes first
    if (orderB !== -1) {
        return 1;
    }

    // Default: Sort recognized nutrients (for display) above unknown ones
    const isEnergyA = idA === NUTRIENT_IDS.ENERGY_KCAL || idA === NUTRIENT_IDS.ENERGY_ATWATER_GENERAL || idA === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC;
    const isEnergyB = idB === NUTRIENT_IDS.ENERGY_KCAL || idB === NUTRIENT_IDS.ENERGY_ATWATER_GENERAL || idB === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC;

    if (isEnergyA && !isEnergyB) return -1;
    if (!isEnergyA && isEnergyB) return 1;

    const aKnown = NUTRIENT_DISPLAY_NAMES[idA] ? 1 : 0;
    const bKnown = NUTRIENT_DISPLAY_NAMES[idB] ? 1 : 0;

    return bKnown - aKnown;
};

// --- Sub-Components & Helpers ---

const renderCalorieValue = (food: NormalizedFood | null) => {
    if (!food) return renderValueOrDash(null);

    // 1. Check for Standard Energy (1008)
    const valStandard = getNutrientValue(food, NUTRIENT_IDS.ENERGY_KCAL);
    if (valStandard !== null) return <span>{valStandard}</span>;

    // 2. Check for Specific Atwater (2048)
    const valSpecific = getNutrientValue(food, NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC);
    if (valSpecific !== null) return (
        <span className="flex items-center justify-center text-purple-700 font-bold">
            {valSpecific} <FlaskConical className="w-3 h-3 ml-1 fill-purple-100 text-purple-500" />
        </span>
    );

    // 3. Check for General Atwater (2047)
    const valGeneral = getNutrientValue(food, NUTRIENT_IDS.ENERGY_ATWATER_GENERAL);
    if (valGeneral !== null) return (
        <span className="flex items-center justify-center text-blue-700 font-bold">
            {valGeneral} <Calculator className="w-3 h-3 ml-1 fill-blue-100 text-blue-500" />
        </span>
    );

    return renderValueOrDash(null);
};


const renderDbStatus = (dbStatus: DatabaseStatus) => {
    let icon;
    let colorClass;
    let text;

    switch (dbStatus) {
        case 'connected':
            icon = <Database className="w-4 h-4 text-emerald-600" />;
            colorClass = 'bg-emerald-100 border-emerald-300';
            text = 'Connected to Supabase Cache';
            break;
        case 'loading':
            icon = <Zap className="w-4 h-4 text-yellow-600 animate-pulse" />;
            colorClass = 'bg-yellow-100 border-yellow-300';
            text = 'Checking Database...';
            break;
        case 'disconnected':
        default:
            icon = <AlertTriangle className="w-4 h-4 text-red-600" />;
            colorClass = 'bg-red-100 border-red-300';
            text = 'DB Disconnected or Cache Table Missing';
            break;
    }

    return (
        <div className={`p-2 rounded-lg transition-colors duration-300 ${colorClass}`}>
            <div className="flex items-center space-x-2 text-sm text-gray-800">
                {icon}
                <span>{text}</span>
            </div>
        </div>
    );
};


// --- Main Component ---

export const FoodDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const routeId = id ?? '';
    const location = useLocation();
    
    // Fallback data from Search State
    const fallbackFdcId = (location.state as any)?.fallbackFdcId ?? null;

    // Metrics state
    const [dbStatus, setDbStatus] = useState<DatabaseStatus>('loading');
    const [metrics, setMetrics] = useState<{ totalTime: number; netTime: number; source: string } | null>(null);

    const [food, setFood] = useState<NormalizedFood | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [retryStatus, setRetryStatus] = useState("");

    // Check DB connection on mount
    useEffect(() => {
        const check = async () => {
            try {
                const res = await import('../services/supabase').then(m => m.checkConnection());
                setDbStatus(res.success ? 'connected' : 'error');
            } catch (e) {
                setDbStatus('error');
            }
        };
        check();
    }, []);

    const fetchDetails = async () => {
        if (!routeId) {
            setError('No Food ID provided.');
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        setRetryStatus("");
        const start = performance.now();
        
        // Detect if the ID is a UUID (Tiles ID)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeId);

        try {
            if (isUuid) {
                // PRIMARY PATH: Fetch from Tiles DB via RPC
                try {
                    console.log(`[FoodDetails] Attempting RPC fetch for UUID: ${routeId}`);
                    const rpcRow = await getTilesFoodDetails(routeId, 'de');
                    
                    if (rpcRow) {
                        const normalized = normalizeTilesFoodDetailsRow(rpcRow);
                        setFood(normalized);
                        
                        const end = performance.now();
                        setMetrics({
                            totalTime: end - start,
                            netTime: 0, 
                            source: 'Supabase RPC'
                        });
                        setLoading(false);
                        return; // Success, exit
                    } else {
                        console.warn("[FoodDetails] RPC returned no data for UUID. Attempting fallback.");
                    }
                } catch (rpcErr) {
                    console.warn("[FoodDetails] RPC Error:", rpcErr);
                    // Fall through to fallback logic
                }
            }

            // CRITICAL FALLBACK PATH
            // Determine FDC ID to use
            let fdcIdCandidate: number | null = null;
            
            if (!isUuid && !isNaN(Number(routeId))) {
                // Legacy URL with FDC ID directly
                fdcIdCandidate = Number(routeId);
            } else if (fallbackFdcId) {
                // Provided via Router State
                fdcIdCandidate = Number(fallbackFdcId);
            }

            if (!fdcIdCandidate) {
                throw new Error("Food Details unavailable: No local record found and no fallback FDC ID provided.");
            }

            console.log(`[FoodDetails] Fallback: Fetching from FDC API (ID: ${fdcIdCandidate})`);
            const data = await usdaService.getFoodDetails(fdcIdCandidate);
            const normalizedData = normalizeFoodItem(data);
            setFood(normalizedData);
            
            const end = performance.now();
            setMetrics({
                totalTime: end - start,
                netTime: 0, 
                source: 'FDC Fallback'
            });

        } catch (err: any) {
            console.error("[FoodDetails] Detail error:", err);
            setError(err.message || 'Failed to load food details');
        } finally {
            setLoading(false);
            setRetryStatus("");
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [routeId]);

    const sortedNutrients = useMemo(() => {
        if (!food?.foodNutrients) return [];
        
        return [...food.foodNutrients]
            .filter(n => {
                const val = typeof n.amount === 'number' ? n.amount : n.value;
                return val !== null && val !== undefined;
            })
            .map(n => ({
                ...n,
                ...getNutrientInfo(n.nutrient?.id || n.nutrientId || 0), 
            }))
            .filter(n => n.name && n.name !== 'Unknown')
            .filter(n => {
                const id = n.nutrient?.id || n.nutrientId;
                return id !== NUTRIENT_IDS.ENERGY_KCAL && 
                       id !== NUTRIENT_IDS.ENERGY_ATWATER_GENERAL && 
                       id !== NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC;
            })
            .sort(sortNutrients);
    }, [food]);

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Lade Lebensmitteldetails...</p>
                {retryStatus && (
                  <p className="text-xs text-gray-400 mt-2">{retryStatus}</p>
                )}
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-2xl mx-auto mt-10 bg-white rounded-2xl p-8 border border-red-100 shadow-lg text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                
                <h2 className="text-xl font-bold text-gray-900 mb-2">Daten nicht verfügbar</h2>
                <p className="text-gray-600 mb-6">{error}</p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button 
                        onClick={fetchDetails}
                        className="inline-flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Erneut versuchen
                    </button>
                    
                    {fallbackFdcId && (
                        <a 
                            href={`https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fallbackFdcId}/nutrients`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <ExternalLink className="w-4 h-4 mr-2" /> Auf USDA ansehen
                        </a>
                    )}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100">
                    <Link to="/ingredients" className="text-sm text-gray-500 hover:text-emerald-600 transition-colors">
                        &larr; Zurück zur Suche
                    </Link>
                </div>
            </div>
        );
    }

    if (!food) {
        return <div className="p-8 text-center text-gray-500">Keine Daten gefunden.</div>;
    }

    const hasSpecificEnergy = (food?.foodNutrients || []).some(n => {
        const nid = n.nutrient?.id || n.id; // Check both nested and flat ID
        return nid === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC;
    });

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header Navigation */}
            <Link to="/ingredients" className="inline-flex items-center text-gray-500 hover:text-gray-900 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
            </Link>

            {/* Developer Metrics Bar */}
            {metrics && (
                <div className="bg-gray-900 text-gray-300 p-4 rounded-xl shadow-lg flex justify-between items-center text-sm">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <Gauge className="w-4 h-4 text-blue-400" />
                            <span>Total: **{metrics.totalTime.toFixed(0)}ms**</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Database className="w-4 h-4 text-emerald-400" />
                            <span>Source: **{metrics.source}**</span>
                        </div>
                    </div>
                    {renderDbStatus(dbStatus)}
                </div>
            )}

            {/* Main Details Card */}
            <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-xl">
                <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-emerald-500 rounded-lg mr-4 flex items-center justify-center">
                        <Utensils className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-500">{food?.dataType || 'Unknown Type'} (FDC: {food?.fdcId})</p>
                        <h1 className="text-3xl font-bold text-gray-900">{food?.description || 'No Description'}</h1>
                    </div>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    <p>Category: <span className="font-semibold text-gray-700">{food?.category || 'N/A'}</span></p>
                </div>
            </div>

            {/* Portions Card */}
            {food?.portions && food.portions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                        <Tag className="w-4 h-4 mr-2 text-gray-400" /> Portions
                    </h3>
                    <ul className="space-y-2">
                        {food.portions.map((portion, idx) => (
                            <li key={portion.id || idx} className="text-sm text-gray-600 flex justify-between border-b border-gray-100 py-2 last:border-b-0">
                                <span>{portion.amount} <span className="font-semibold">{portion.unitDescription}</span></span>
                                <span className="text-gray-900 font-medium">{portion.gramWeight}g</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Macronutrient Summary */}
            <div className="grid grid-cols-4 gap-4">
                <div className={`bg-white rounded-lg p-3 text-center border-2 ${hasSpecificEnergy ? 'border-purple-300' : 'border-gray-200'}`}>
                    <div className="text-xs text-gray-500 mb-0.5 flex items-center justify-center">
                        Energy <span className={`w-3 h-3 ml-1 ${hasSpecificEnergy ? 'text-purple-500' : 'text-gray-500'}`} title={hasSpecificEnergy ? 'Atwater Specific Calculation' : 'Standard Calculation'}><BarChart3 className="w-3 h-3" /></span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
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
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-500 mb-0.5">Carbs</div>
                    <div className="font-bold text-gray-900">
                        {renderValueOrDash(getNutrientValue(food, NUTRIENT_IDS.CARBOHYDRATE_BY_DIFF))}<span className="text-[10px] font-normal text-gray-500">g</span>
                    </div>
                </div>
            </div>

            {/* Detailed Nutrient List */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2 text-gray-400" /> Detaillierte Nährwertangaben (pro 100g)
                </h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Nährstoff
                                </th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Wert
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {sortedNutrients.map((info, index) => {
                                const displayName = info.name;
                                const isHighlight = info.id && !!NUTRIENT_DISPLAY_NAMES[info.id];
                                const val = typeof info.amount === 'number' ? info.amount : info.value;
                                const id = info.nutrient?.id || info.nutrientId;
                                
                                let icon = null;
                                let rowClass = isHighlight ? 'font-medium bg-emerald-50/50' : 'text-gray-600';

                                if (id === NUTRIENT_IDS.ENERGY_ATWATER_SPECIFIC) {
                                    icon = <FlaskConical className="w-3 h-3 ml-2 fill-purple-100 text-purple-500" />;
                                    rowClass = 'font-bold bg-purple-50/50 text-purple-800';
                                } else if (id === NUTRIENT_IDS.ENERGY_ATWATER_GENERAL) {
                                    icon = <Calculator className="w-3 h-3 ml-2 fill-blue-100 text-blue-500" />;
                                    rowClass = 'font-bold bg-blue-50/50 text-blue-800';
                                } else if (id === NUTRIENT_IDS.ENERGY_KCAL) {
                                    icon = <BarChart3 className="w-3 h-3 ml-2 fill-gray-100 text-gray-500" />;
                                }

                                return (
                                    <tr key={info.id || index} className={rowClass}>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm flex items-center">
                                            {displayName}
                                            {icon}
                                        </td>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-right">
                                            <span className="font-mono text-gray-900">{renderValueOrDash(val)}</span>
                                            <span className="text-[10px] font-normal text-gray-500 ml-1">{info.unitName}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};