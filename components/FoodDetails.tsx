
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Tag, BarChart3, FlaskConical, Gauge, Calculator, Utensils, Zap, Database, AlertTriangle } from 'lucide-react';

import { getNutrientValue, getNutrientInfo, renderValueOrDash } from '../services/nutrientUtils';
import { usdaService } from '../services/usdaService';
import { NormalizedFood, NormalizedFoodNutrient, DatabaseStatus } from '../types';
import { NUTRIENT_IDS, NUTRIENT_DISPLAY_NAMES, NUTRIENT_ORDER } from '../constants';
import { normalizeFoodItem } from '../services/normalizer';

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

/**
 * Renders the primary calorie value, prioritizing the most accurate Atwater method.
 * Also adds the icon based on the calculation method.
 */
const renderCalorieValue = (food: NormalizedFood) => {
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

    // Fallback if no energy value is found
    return renderValueOrDash(null);
};


/**
 * Renders the status indicator for the database connection.
 */
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
    const fdcId = Number(id);
    
    // Use state to store service metrics since we are not using a hook for the service anymore
    const [dbStatus, setDbStatus] = useState<DatabaseStatus>('loading');
    const [metrics, setMetrics] = useState<{ totalTime: number; netTime: number; source: string } | null>(null);

    const [food, setFood] = useState<NormalizedFood | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Check DB connection on mount
    useEffect(() => {
        const check = async () => {
            const res = await import('../services/supabase').then(m => m.checkConnection());
            setDbStatus(res.success ? 'connected' : 'error');
        };
        check();
    }, []);

    useEffect(() => {
        if (!fdcId) {
            setError('Keine FDC ID angegeben.');
            setLoading(false);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            const start = performance.now();
            
            try {
                // 1. Fetch raw data from cache or API via the service
                // We overwrite the logPerformance temporarily to capture metrics
                const rawData = await usdaService.getFoodDetails(fdcId);
                const end = performance.now();
                
                // Simple metric estimation (approximation as we can't easily hook into the service internals from here without refactoring service)
                // In a real app, we would expose an observable or callback from the service.
                setMetrics({
                    totalTime: end - start,
                    netTime: 0, // Cannot measure internal net time from here easily
                    source: 'Service'
                });

                // 2. Normalize the raw data locally
                const normalizedFood = normalizeFoodItem(rawData);
                
                setFood(normalizedFood);
            } catch (err: any) {
                console.error("Fehler beim Abrufen der Lebensmitteldetails:", err);
                setError(`Fehler beim Laden der Details für ID ${fdcId}: ${err.message || 'Unbekannter Fehler'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [fdcId]);

    const sortedNutrients = useMemo(() => {
        if (!food?.foodNutrients) return [];
        return [...food.foodNutrients]
            .filter(n => {
                const val = typeof n.amount === 'number' ? n.amount : n.value;
                // Keep nutrients even if value is 0
                return val !== null && val !== undefined;
            })
            .map(n => ({
                ...n,
                ...getNutrientInfo(n.nutrient?.id || n.nutrientId || 0), // Merge with display names/units from constants
            }))
            // FIX 1: Filter out Unknown nutrients
            .filter(n => n.name && n.name !== 'Unknown')
            // FIX 2: Explicitly filter out duplicate Energy entries in the list
            .filter(n => {
                const id = n.nutrient?.id || n.nutrientId;
                // We display energy prominently in tiles, so remove it from the list
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
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 text-center text-red-600">
                <AlertTriangle className="w-8 h-8 mx-auto mb-3" />
                <p className="font-bold">Ladefehler:</p>
                <p className="text-sm">{error}</p>
                <Link to="/ingredients" className="mt-4 inline-flex items-center text-emerald-600 hover:text-emerald-800 transition-colors text-sm">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Zurück zur Suche
                </Link>
            </div>
        );
    }

    if (!food) {
        return <div className="p-8 text-center text-gray-500">Keine Daten gefunden.</div>;
    }

    // Determine Energy Style
    const hasSpecificEnergy = food.foodNutrients.some(n => {
        const nid = n.nutrient?.id || n.id;
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
                            <span>Total: **{metrics.totalTime.toFixed(2)}ms**</span>
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
                        <p className="text-sm font-semibold text-gray-500">{food.dataType} (ID: {food.fdcId})</p>
                        <h1 className="text-3xl font-bold text-gray-900">{food.description}</h1>
                    </div>
                </div>

                <div className="text-xs text-gray-500 mt-2">
                    <p>FDC Category: <span className="font-semibold text-gray-700">{food.category} ({food.category_code})</span></p>
                    <p className="mt-1">
                        Dies ist der vollständige FDC-Eintrag. Die Rohdaten wurden entweder aus der USDA-Datenbank abgerufen (lange Latenz) oder aus dem lokalen Supabase-Cache geladen (schnelle Latenz) und in deiner privaten Datenbank gespeichert.
                    </p>
                    <div className="text-xs text-emerald-600">
                        Published: {food.publicationDate}
                    </div>
                </div>
            </div>

            {/* Portions Card */}
            {food.portions && food.portions.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3 flex items-center">
                        <Tag className="w-4 h-4 mr-2 text-gray-400" /> Portions
                    </h3>
                    <ul className="space-y-2">
                        {food.portions.map((portion) => (
                            <li key={portion.id} className="text-sm text-gray-600 flex justify-between border-b border-gray-100 py-2 last:border-b-0">
                                <span>{portion.amount} <span className="font-semibold">{portion.unitDescription}</span></span>
                                <span className="text-gray-900 font-medium">{portion.gramWeight}g</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Macronutrient Summary (Kacheln) */}
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
                                // 4. Display Logic
                                const displayName = info.name;
                                // Highlight known nutrients (defined in NUTRIENT_DISPLAY_NAMES)
                                const isHighlight = info.id && !!NUTRIENT_DISPLAY_NAMES[info.id];
                                const val = typeof info.amount === 'number' ? info.amount : info.value;
                                const id = info.nutrient?.id || info.nutrientId;
                                
                                // Determine Row Style
                                let rowClass = isHighlight ? 'font-medium bg-emerald-50/30' : 'text-gray-600';

                                return (
                                    <tr key={info.id || index} className={rowClass}>
                                        <td className="px-6 py-3 whitespace-nowrap text-sm flex items-center">
                                            {displayName}
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
