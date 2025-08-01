'use client';

import { useRouter } from 'next/navigation';

export default function FooterButtons() {
    const router = useRouter();

    return (
        <div className="flex items-center space-x-4" suppressHydrationWarning>

            <button
                onClick={() => router.push('/login')}
                className="flex items-center space-x-2 hover:text-[var(--tab-hover-text)] transition-colors text-[var(--tab-text)] opacity-50 hover:opacity-100"
                aria-label="Mmmm"
                title="Mmmm"
            >
                <span className="text-lg">ㅤㅤ</span>
            </button>
        </div>
    );
}
