import { DEFAULT_PAGE_SIZE, DEFAULT_DATA_TYPES, API_REQUEST_NUTRIENT_NUMBERS } from '../constants';
import { FDCSearchResponse, FDCFoodItem } from '../types';
import { supabase } from './supabase';

const parseProxyResponse = async (response: Response) => {
  let json: any = null;
  try {
    json = await response.json();
  } catch (_) {
    json = null;
  }

  return {
    success: json?.success === true,
    status: typeof json?.status === "number" ? json.status : -1,
    data: json?.data ?? null,
    error: json?.error ?? null
  };
};

class USDAService {
  async searchFoods(
    query: string, 
    pageNumber = 1, 
    dataTypes = DEFAULT_DATA_TYPES
  ): Promise<FDCSearchResponse> {
    const requestBody = {
      action: 'search',
      query: query,
      dataType: dataTypes,
      pageSize: DEFAULT_PAGE_SIZE,
      pageNumber: pageNumber,
      sortBy: 'dataType.keyword',
      sortOrder: 'asc'
    };

    // Use responseType 'text' to get the raw body string, then wrap in a Response object
    // to strictly match the parseProxyResponse signature required.
    const { data, error } = await supabase.functions.invoke('usda-proxy', {
      body: requestBody,
      responseType: 'text'
    });

    if (error) {
      throw new Error(error.message);
    }

    const response = new Response(data, { status: 200 });
    const r = await parseProxyResponse(response);

    if (!r.success) {
      throw new Error(`USDA Search Error: Status ${r.status}`);
    }

    return r.data;
  }

  async getFoodDetails(fdcId: number): Promise<FDCFoodItem> {
    const requestBody = {
      action: 'details',
      fdcId: fdcId,
      nutrients: API_REQUEST_NUTRIENT_NUMBERS
    };

    const { data, error } = await supabase.functions.invoke('usda-proxy', {
      body: requestBody,
      responseType: 'text'
    });

    if (error) {
      throw new Error(error.message);
    }

    const response = new Response(data, { status: 200 });
    const r = await parseProxyResponse(response);

    if (!r.success) {
      throw new Error(`USDA Details Error: Status ${r.status}`);
    }

    return r.data;
  }
}

export const usdaService = new USDAService();