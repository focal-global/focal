export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground">
          Last updated: January 2026
        </p>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Focal, you accept and agree to be bound by the terms 
            and provision of this agreement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">2. Local-First Architecture</h2>
          <p>
            Focal operates on a Local-First architecture. Your billing data is processed 
            entirely in your browser and is never transmitted to our servers. We only store 
            authentication credentials and metadata necessary to provide the service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">3. Use License</h2>
          <p>
            Permission is granted to use Focal for personal and commercial cloud cost 
            management purposes. This license shall automatically terminate if you violate 
            any of these restrictions.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">4. Disclaimer</h2>
          <p>
            The materials on Focal are provided on an &apos;as is&apos; basis. Focal makes no 
            warranties, expressed or implied, and hereby disclaims and negates all other 
            warranties including, without limitation, implied warranties or conditions of 
            merchantability, fitness for a particular purpose, or non-infringement of 
            intellectual property or other violation of rights.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">5. Contact</h2>
          <p>
            If you have any questions about these Terms, please contact us.
          </p>
        </section>
      </div>
    </div>
  );
}
