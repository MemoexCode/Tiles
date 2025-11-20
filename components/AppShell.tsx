import React from 'react';
import { LayoutDashboard, Utensils, Apple, Settings, Menu } from 'lucide-react';
import { NavItem } from '../types';
import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Recipes', path: '/recipes', icon: Utensils },
  { label: 'Ingredients', path: '/ingredients', icon: Apple },
  { label: 'Settings', path: '/settings', icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-800">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col bg-white border-r border-gray-200 fixed h-full z-10">
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg mr-3 flex items-center justify-center">
            <Utensils className="text-white w-5 h-5" />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Tiles</span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  active 
                    ? 'bg-emerald-50 text-emerald-700 font-medium shadow-sm' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${active ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="bg-emerald-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-800 mb-1">USDA Connected</p>
            <p className="text-[10px] text-emerald-600 leading-relaxed">
              Powered by FoodData Central API.
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg mr-3 flex items-center justify-center">
            <Utensils className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-gray-900">Tiles</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-gray-800 bg-opacity-50 z-30" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="bg-white w-64 h-full shadow-xl p-4" onClick={(e) => e.stopPropagation()}>
             <nav className="space-y-2 mt-12">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-lg ${
                    isActive(item.path) ? 'bg-emerald-50 text-emerald-700' : 'text-gray-600'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 min-h-screen transition-all duration-300 ease-in-out">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};