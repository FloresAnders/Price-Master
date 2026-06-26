"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function sendGooglePageView(pagePath: string) {
  if (!GA_ID) return;

  window.dataLayer = window.dataLayer || [];

  if (typeof window.gtag === "function") {
    window.gtag("config", GA_ID, { page_path: pagePath });
    return;
  }

  window.dataLayer.push(["config", GA_ID, { page_path: pagePath }]);
}

export default function GoogleAnalytics() {
  const pathname = usePathname();
  const isInitialPageView = useRef(true);

  useEffect(() => {
    if (!GA_ID) return;

    const sendCurrentPageView = () => {
      sendGooglePageView(
        `${pathname}${window.location.search}${window.location.hash}`,
      );
    };

    if (isInitialPageView.current) {
      isInitialPageView.current = false;
    } else {
      sendCurrentPageView();
    }

    window.addEventListener("hashchange", sendCurrentPageView);
    return () => window.removeEventListener("hashchange", sendCurrentPageView);
  }, [pathname]);

  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
