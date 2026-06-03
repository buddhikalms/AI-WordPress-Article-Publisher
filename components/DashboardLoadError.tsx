"use client";

type DashboardLoadErrorProps = {
  title: string;
  message: string;
  onRetry: () => void;
  onSignOut: () => void;
};

export default function DashboardLoadError({
  title,
  message,
  onRetry,
  onSignOut,
}: DashboardLoadErrorProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[760px] items-center px-4 py-8">
      <section className="panel w-full px-5 py-5 md:px-6">
        <p className="eyebrow">Account Load Failed</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-950">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="button-primary" onClick={onRetry}>
            Retry
          </button>
          <button type="button" className="button-muted" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}
