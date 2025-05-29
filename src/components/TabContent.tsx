'use client';
import { ActiveTab } from '@/types';
import BarcodeScanner from '@/components/BarcodeScanner';
import PriceCalculator from '@/components/PriceCalculator';
import TextConversion from '@/components/TextConversion';
import ScanHistory from '@/components/ScanHistory';
import ScannerTips from '@/components/ScannerTips';
import CalculatorInfo from '@/components/CalculatorInfo';
import ConverterUseCases from '@/components/ConverterUseCases';
import EmptyHistoryState from '@/components/EmptyHistoryState';
import ClearHistoryButton from '@/components/ClearHistoryButton';

interface TabContentProps {
    activeTab: ActiveTab;
    scanHistory: string[];
    onCodeDetected: (code: string) => void;
    onGoToScanner: () => void;
    onClearHistory: () => void;
}

export default function TabContent({
    activeTab,
    scanHistory,
    onCodeDetected,
    onGoToScanner,
    onClearHistory
}: TabContentProps) {
    return (
        <div className="space-y-8">
            {activeTab === 'scanner' && (
                <div className="max-w-4xl mx-auto">
                    <BarcodeScanner onDetect={onCodeDetected} />
                    <ScannerTips />
                </div>
            )}

            {activeTab === 'calculator' && (
                <div className="max-w-6xl mx-auto">
                    <PriceCalculator />
                    <CalculatorInfo />
                </div>
            )}

            {activeTab === 'converter' && (
                <div className="max-w-6xl mx-auto">
                    <TextConversion />
                    <ConverterUseCases />
                </div>
            )}

            {activeTab === 'history' && (
                <div className="max-w-4xl mx-auto">
                    <ScanHistory history={scanHistory} />

                    {scanHistory.length > 0 && (
                        <ClearHistoryButton onClear={onClearHistory} />
                    )}

                    {scanHistory.length === 0 && (
                        <EmptyHistoryState onGoToScanner={onGoToScanner} />
                    )}
                </div>
            )}
        </div>
    );
}
