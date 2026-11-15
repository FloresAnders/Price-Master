"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LegacyHomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          Redirigiendo a Time Master…
        </p>
        <Link
          href="/"
          replace
          className="mt-4 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
        >
          Ir a Time Master
        </Link>
      </div>
    </main>
  );
}
