'use client';

/**
 * Navigation Progress Bar
 * 
 * Shows a loading indicator at the top of the page during navigation.
 * Provides instant visual feedback that something is happening.
 */

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Reset when navigation completes
    setIsNavigating(false);
    setProgress(100);
    
    const timeout = setTimeout(() => {
      setProgress(0);
    }, 200);
    
    return () => clearTimeout(timeout);
  }, [pathname, searchParams]);

  // Listen for navigation start via click events
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      
      if (link && link.href && !link.target && !link.download) {
        const url = new URL(link.href);
        if (url.origin === window.location.origin && url.pathname !== pathname) {
          setIsNavigating(true);
          setProgress(30);
          
          // Animate progress
          const interval = setInterval(() => {
            setProgress(p => {
              if (p >= 90) {
                clearInterval(interval);
                return 90;
              }
              return p + 10;
            });
          }, 100);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [pathname]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ 
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
