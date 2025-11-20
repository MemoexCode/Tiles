import React from 'react';
import { Utensils, Apple, Plus, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-2">Here's an overview of your recipe collection.</p>
        </div>
        <Link to="/recipes/new" className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          <Plus className="w-4 h-4 mr-2" />
          New Recipe
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stats Tiles */}
        <div className="bg-emerald-500 rounded-2xl p-6 text-white shadow-lg shadow-emerald-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-emerald-100">Total Recipes</p>
              <h2 className="text-4xl font-bold mt-2">12</h2>
            </div>
            <div className="p-2 bg-emerald-400 rounded-lg bg-opacity-50">
              <Utensils className="w-6 h-6 text-white" />
            </div>
          </div>
          <div className="mt-6 flex items-center text-sm text-emerald-100">
            <span className="bg-emerald-600 px-2 py-1 rounded text-xs mr-2">+2</span>
            added this week
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-500">Saved Ingredients</p>
              <h2 className="text-4xl font-bold mt-2 text-gray-900">45</h2>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg">
              <Apple className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <div className="mt-6 flex items-center text-sm text-gray-400">
            Synced with USDA FDC
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
           <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-500">Avg. Calories</p>
              <h2 className="text-4xl font-bold mt-2 text-gray-900">480</h2>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg">
              <Activity className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <div className="mt-6 flex items-center text-sm text-gray-400">
            Per serving across recipes
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Updates</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
           <p className="text-gray-400">Your recent recipe activity will appear here.</p>
        </div>
      </div>
    </div>
  );
};