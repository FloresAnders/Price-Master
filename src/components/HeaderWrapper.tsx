'use client'

import { useState, useEffect } from 'react';
import Header from './Header';

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'histoscans' | 'edit';

export default function HeaderWrapper() {
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure component is mounted on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Listen to hash changes to update active tab
  useEffect(() => {
    if (!isClient) return;

    const updateTabFromHash = () => {
      const hash = window.location.hash.replace('#', '') as ActiveTab;
      const validTabs = [
        'scanner', 'calculator', 'converter', 'cashcounter', 'timingcontrol', 'controlhorario', 'supplierorders', 'histoscans', 'edit'
      ];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      } else {
        setActiveTab(null);
      }
    };

    updateTabFromHash();
    
    const handleHashChange = () => {
      updateTabFromHash();
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [isClient]);

  return <Header activeTab={activeTab} onTabChange={setActiveTab} />;
}