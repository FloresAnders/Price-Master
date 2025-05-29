'use client';
import { TabConfig, ActiveTab } from '@/types';

interface TabNavigationProps {
    tabs: TabConfig[];
    activeTab: ActiveTab;
    onTabChange: (tab: ActiveTab) => void;
}

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
    return (
        <div className="mb-8">
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                group relative min-w-0 flex-1 overflow-hidden py-4 px-1 text-center text-sm font-medium hover:text-gray-700 focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors
                ${activeTab === tab.id
                                    ? 'text-indigo-600 border-b-2 border-indigo-500'
                                    : 'text-gray-500 border-b-2 border-transparent hover:border-gray-300'
                                }
              `}
                        >
                            <div className="flex items-center justify-center space-x-2">
                                <span className="text-lg">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.name}</span>
                                {tab.badge && (
                                    <span className="ml-1 py-0.5 px-2 rounded-full text-xs bg-indigo-100 text-indigo-600">
                                        {tab.badge}
                                    </span>
                                )}
                            </div>
                            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-200" />
                        </button>
                    ))}
                </nav>
            </div>
        </div>
    );
}
