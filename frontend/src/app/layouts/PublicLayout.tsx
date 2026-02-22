import { Outlet } from 'react-router-dom';
import { LivingBackground } from '@/features/public/landing/components/LivingBackground';
import { LandingNav } from '@/features/public/landing/components/LandingNav';
import { LandingFooter } from '@/features/public/landing/components/LandingFooter';
import { ScrollToTop } from '../components/ScrollToTop';

export function PublicLayout() {
  return (
    <>
      <ScrollToTop />
      <div className="relative min-h-screen">
        <LivingBackground />
        <LandingNav />
        <main className="relative z-10">
          <Outlet />
        </main>
        <LandingFooter />
      </div>
    </>
  );
}
