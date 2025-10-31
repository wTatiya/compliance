import Head from 'next/head';

export default function Home() {
  return (
    <>
      <Head>
        <title>Compliance Document Hub</title>
        <meta name="description" content="Centralize compliance documentation and workflows" />
      </Head>
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-24">
          <h1 className="text-4xl font-bold">Compliance Document Hub</h1>
          <p className="text-lg text-slate-700">
            A foundational Next.js application scaffolded to power the compliance knowledge base. The
            frontend consumes the NestJS API and PostgreSQL database defined in the shared monorepo.
          </p>
          <ul className="list-disc space-y-2 pl-6 text-slate-700">
            <li>Type-safe data fetching with React Query (to be added).</li>
            <li>Role-based access control backed by the NestJS API.</li>
            <li>Composable UI primitives to standardize compliance workflows.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
