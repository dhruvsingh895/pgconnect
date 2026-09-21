'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-state">
      <h1>We hit a small snag.</h1>
      <p>Please try loading this page again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
