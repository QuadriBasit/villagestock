import { useScrollReveal } from '@/components/landing/hooks';
import '@/components/landing/landing.css';
import { AuroraBackground } from '@/components/landing/AuroraBackground';
import { LandingNav } from '@/components/landing/LandingNav';
import { Hero } from '@/components/landing/Hero';
import { LogoStrip } from '@/components/landing/LogoStrip';
import { StatsBand } from '@/components/landing/StatsBand';
import { Features } from '@/components/landing/Features';
import { Comparison } from '@/components/landing/Comparison';
import { OfflineStrip } from '@/components/landing/OfflineStrip';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { WhoItsFor } from '@/components/landing/WhoItsFor';
import { Testimonials } from '@/components/landing/Testimonials';
import { Pricing } from '@/components/landing/Pricing';
import { Faq } from '@/components/landing/Faq';
import { CallToAction } from '@/components/landing/CallToAction';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  useScrollReveal();

  return (
    <div className="vs-landing">
      <AuroraBackground />
      <LandingNav />
      <Hero />
      <LogoStrip />
      <StatsBand />
      <Features />
      <Comparison />
      <OfflineStrip />
      <HowItWorks />
      <WhoItsFor />
      <Testimonials />
      <Pricing />
      <Faq />
      <CallToAction />
      <LandingFooter />
    </div>
  );
}
