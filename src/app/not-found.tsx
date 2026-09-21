import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="loading-state">
      <h1>This page has moved out.</h1>
      <p>Let’s get you back to your workspace.</p>
      <Link className="button primary" href="/login">
        Back to sign in
      </Link>
    </main>
  );
}
