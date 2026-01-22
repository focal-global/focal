'use client';

/**
 * Marketing Layout
 * 
 * Separate layout for marketing/landing pages.
 * Isolated from the dashboard to keep concerns separate.
 */

import { ReactNode } from 'react';

interface MarketingLayoutProps {
  children: ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {children}
    </div>
  );
}
