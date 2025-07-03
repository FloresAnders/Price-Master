'use client'

import { useState, useEffect } from 'react';
import Header from './Header';

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'history' | 'timingcontrol' | 'controlhorario' | 'supplierorders';

export default function HeaderWrapper() {
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);

  // Listen to hash changes to update active tab
  useEffect(() => {
    const updateTabFromHash = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        const validTabs = [
          'scanner', 'calculator', 'converter', 'cashcounter', 'history', 'timingcontrol', 'controlhorario', 'supplierorders'
        ];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab(null);
        }
      }
    };

    updateTabFromHash();
    
    const handleHashChange = () => {
      updateTabFromHash();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', handleHashChange);
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, []);

  return <Header activeTab={activeTab} onTabChange={setActiveTab} />;
}