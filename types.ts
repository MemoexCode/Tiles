import React from 'react';

// USDA FoodData Central Data Types based on Documentation

export enum DataType {
  Foundation = 'Foundation',
  SRLegacy = 'SR Legacy',
}

// Refined based on OpenAPI Spec provided

// 1. Nutrient Definition (Nested inside FoodNutrient for Foundation Foods)
interface BaseNutrient {
  id: number;
  number: string;
  name: string;
  rank: number;
  unitName: string;
}

// 2. Abridged Food Nutrient (Used in Search Results / Abridged Format)
export interface AbridgedFoodNutrient {
  nutrientId: number;
  nutrientName: string;
  unitName: string;
  value: number;
}

// 3. Full Food Nutrient (Used in Detail Views for Foundation/Legacy with format=full)
export interface FoodNutrient {
  id: number; // This is the ID of the relation/record, NOT the nutrient ID
  type?: string; 
  amount?: number; // Standard field for quantity in Full format (Foundation)
  
  // Foundation Foods use this nested object for nutrient details
  nutrient?: BaseNutrient; 

  // SR Legacy often uses flat fields.
  // We keep these to preserve the existing extraction logic in normalizer/components.
  nutrientId?: number; 
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number; // Used in SR Legacy instead of amount
}

export interface FoodPortion {
  id: number;
  measureUnit: {
    id: number;
    name: string;
    abbreviation: string;
  };
  modifier: string;
  gramWeight: number;
  sequenceNumber: number;
  amount: number;
}

// Detailed Food Item (Foundation/SR Legacy)
export interface FDCFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  publicationDate: string;
  
  // The API returns different structures based on 'format' parameter.
  // We request 'full', so we get FoodNutrient[]
  foodNutrients: FoodNutrient[]; 
  
  foodPortions?: FoodPortion[];
  score?: number;
  ndbNumber?: number;
  scientificName?: string;
}

// Search Result Item (Abridged)
export interface SearchResultFood {
  fdcId: number;
  description: string;
  dataType: string;
  publishedDate: string;
  score: number;
  // Search results return the 'AbridgedFoodNutrient' structure
  foodNutrients: AbridgedFoodNutrient[];
}

export interface FDCSearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  pageList: number[];
  foodSearchCriteria: {
    query: string;
    dataType: string[];
    pageSize: number;
    pageNumber: number;
    sortBy: string;
    sortOrder: string;
  };
  foods: SearchResultFood[];
}

// --- Database Types (Phase 1: Persistence Layer) ---

export interface USDAFoodRaw {
  fdc_id: number;
  data_type: string;
  raw_json: FDCFoodItem; // Stores the full API response
  fetched_at: string; // ISO Timestamp
  
  // New fields for AI & Normalization Strategy (Phase 3 & 4)
  visual_parent?: string | null; // Grouping for AI Image Generation (e.g. "Milk")
  normalized_json?: any | null; // Standardized Nutrient Object for Meal Planner
}

// App Specific Types
export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}