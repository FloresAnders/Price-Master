'use client';
import { TabConfig, ActiveTab } from '@/types';

interface TabHeaderProps {
    tabs: TabConfig[];
    activeTab: ActiveTab;
}

export default function TabHeader({ tabs, activeTab }: TabHeaderProps) {
    const currentTab = tabs.find(tab => tab.id === activeTab);

    if (!currentTab) return null;

    return (
        <div className="mb-6">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {currentTab.name}
                </h2>
                <p className="text-gray-600">
                    {currentTab.description}
                </p>
            </div>
        </div>
    );
}