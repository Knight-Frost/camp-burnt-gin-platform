import { Helmet } from 'react-helmet-async';
import { HeroSection } from '../components/HeroSection';
import { MissionSection } from '../components/MissionSection';
import { ImageSection } from '../components/ImageSection';
import { FAQSection } from '../components/FAQSection';
import { CTASection } from '../components/CTASection';

export function LandingPage() {
  const siteUrl = 'https://www.campburntgin.org';
  const title = 'Camp Burnt Gin — Summer Camp for Children with Special Health Care Needs';
  const description =
    'Camp Burnt Gin provides week-long residential camp experiences for children with special health care needs. Apply now for Summer 2026.';
  const image = `${siteUrl}/og-image.jpg`;

  return (
    <>
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={siteUrl} />

        <meta property="og:type" content="website" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={image} />
        <meta property="og:site_name" content="Camp Burnt Gin" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={siteUrl} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={image} />

        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Camp Burnt Gin',
            url: siteUrl,
            logo: `${siteUrl}/logo.png`,
            description:
              'Camp Burnt Gin provides transformative summer camp experiences for children with special health care needs.',
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: '+1-555-123-4567',
              contactType: 'Customer Service',
              email: 'info@campburntgin.org',
            },
            address: {
              '@type': 'PostalAddress',
              streetAddress: '123 Camp Road',
              addressLocality: 'Wilderness',
              addressRegion: 'State',
              postalCode: '12345',
              addressCountry: 'US',
            },
          })}
        </script>
      </Helmet>

      <HeroSection />
      <MissionSection />
      <ImageSection />
      <FAQSection />
      <CTASection />
    </>
  );
}
