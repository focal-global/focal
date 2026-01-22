/**
 * Root Page
 * 
 * Redirects to the modern landing page.
 * The landing page is kept in a separate (marketing) route group for organization.
 */

import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/landing');
}

