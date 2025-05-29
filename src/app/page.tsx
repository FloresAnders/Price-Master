'use client';
import { useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TabNavigation from '@/components/TabNavigation';
import TabHeader from '@/components/TabHeader';
import TabContent from '@/components/TabContent';
import { useTabConfig } from '@/hooks/useTabConfig';
import { useScanHistory } from '@/hooks/useScanHistory';
import { ActiveTab } from '@/types';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner');
  const { scanHistory, handleCodeDetected, clearHistory } = useScanHistory();
  const tabs = useTabConfig({ scanHistoryCount: scanHistory.length });

  const handleGoToScanner = () => setActiveTab('scanner');

  return (
    <>
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <TabHeader
          tabs={tabs}
          activeTab={activeTab}
        />

        <TabContent
          activeTab={activeTab}
          scanHistory={scanHistory}
          onCodeDetected={handleCodeDetected}
          onGoToScanner={handleGoToScanner}
          onClearHistory={clearHistory}
        />
      </main>
      <Footer />
    </>
  );
}