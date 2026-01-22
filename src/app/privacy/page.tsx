export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-muted-foreground">
          Last updated: January 2026
        </p>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Our Commitment to Privacy</h2>
          <p>
            Focal is built on a <strong>Local-First</strong> architecture. This means your 
            sensitive billing data never leaves your browser. We believe your cloud cost 
            data belongs to you, and you alone.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">What We Don&apos;t Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your cloud billing data</li>
            <li>Your storage account credentials (these stay in your browser)</li>
            <li>Your cost reports or analytics results</li>
            <li>Any data processed by DuckDB in your browser</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">What We Do Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address (for authentication)</li>
            <li>Account metadata (organization name, user preferences)</li>
            <li>Connector metadata (storage account names, not credentials)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">How It Works</h2>
          <p>
            When you connect a cloud storage account, Focal generates a secure, time-limited 
            access token (SAS token) that your browser uses to directly query your data. 
            This token and all billing data remain exclusively in your browser&apos;s memory 
            and local storage.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Third-Party Services</h2>
          <p>
            We use the following third-party services:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Neon</strong> - For authentication database (user accounts only)</li>
            <li><strong>Vercel</strong> - For hosting the application</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Contact</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us.
          </p>
        </section>
      </div>
    </div>
  );
}
