
import { createClient } from '@supabase/supabase-js';

// Safe access to process.env to avoid ReferenceError in browser
const env = (typeof process !== 'undefined' && process.env) || {};

// ACHTUNG: Diese Werte müssen durch deine echten Werte aus Schritt 3 ersetzt werden.
// Normalerweise nutzt man dafür Umgebungsvariablen (.env), aber für den Start 
// kannst du sie hier temporär eintragen, wenn du lokal arbeitest.
// In einer echten Produktion gehören diese NIEMALS fest in den Code committed.

// Schritt 3: "Project URL" hier einfügen
const SUPABASE_URL = env.REACT_APP_SUPABASE_URL || 'https://enrlfqsamzjmxndbayul.supabase.co';

// Schritt 3: "anon public key" hier einfügen
const SUPABASE_ANON_KEY = env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVucmxmcXNhbXpqbXhuZGJheXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM2NDQ2ODYsImV4cCI6MjA3OTIyMDY4Nn0.oglj8Gw2LmZEVRzoygb68Yf5yRT0nYJERx_z-GVIJ5k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Prüft, ob die Verbindung zur Datenbank funktioniert.
 * @returns true bei Erfolg, false bei Fehler
 */
export const checkConnection = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    // Wir versuchen, einen sehr leichten Zugriff auf die spezifische Tabelle 'usda_food_raw'
    // Das stellt sicher, dass nicht nur Supabase erreichbar ist, sondern auch die Tabelle existiert.
    const { count, error } = await supabase
      .from('usda_food_raw')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.warn('Supabase connection check failed:', error.message);
      // Semantische Fehlermeldung für den User
      if (error.code === 'PGRST204') { // PostgREST Error für "Tabelle nicht gefunden"
         return { success: false, message: "Table 'usda_food_raw' not found. Please run the SQL setup." };
      }
      return { success: false, message: `Error: ${error.message}` };
    }
    
    return { success: true, message: `Connected. Cache contains ${count || 0} items.` };
  } catch (err) {
    console.error('Supabase unexpected error:', err);
    return { success: false, message: err instanceof Error ? err.message : 'Unknown connection error' };
  }
};