"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="legal stack">
      <h1>Something interrupted your session.</h1>
      <p>
        Please try again. If this continues, check your connection and project
        configuration.
      </p>
      <button className="btn primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
