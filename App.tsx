
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { FoodSearch } from './components/FoodSearch';
import { FoodDetails } from './components/FoodDetails';
import { Dashboard } from './components/Dashboard';
import { Settings } from './components/Settings';

function App() {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ingredients" element={<FoodSearch />} />
          <Route path="/food/:id" element={<FoodDetails />} />
          
          {/* Placeholders for future functionality */}
          <Route path="/recipes" element={
            <div className="text-center py-20">
              <h2 className="text-xl font-bold text-gray-800">Recipe Manager</h2>
              <p className="text-gray-500 mt-2">Recipe creation and AI generation coming soon.</p>
            </div>
          } />
          <Route path="/recipes/new" element={
             <div className="text-center py-20">
              <h2 className="text-xl font-bold text-gray-800">New Recipe</h2>
              <p className="text-gray-500 mt-2">Builder coming in next phase.</p>
            </div>
          } />
          
          <Route path="/settings" element={<Settings />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
