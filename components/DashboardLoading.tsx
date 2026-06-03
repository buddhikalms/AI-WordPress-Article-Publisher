"use client";

type DashboardLoadingProps = {
  title: string;
};

export default function DashboardLoading({ title }: DashboardLoadingProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1200px] items-start px-3 py-3 md:px-4 md:py-4">
      <div className="w-full space-y-4">
        <div className="panel px-4 py-4 md:px-5">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-24" />
            <div className="skeleton h-10 flex-1" />
            <div className="skeleton h-10 w-44" />
          </div>
        </div>

        <div className="page-header">
          <div className="space-y-2">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-6 w-56" />
            <div className="skeleton h-4 w-full max-w-2xl" />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div className="panel px-4 py-4 md:px-5">
            <p className="text-xs text-slate-500">{title}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="skeleton h-24" />
              <div className="skeleton h-24" />
              <div className="skeleton h-44 md:col-span-2" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="panel px-4 py-4">
              <div className="skeleton h-24" />
            </div>
            <div className="panel px-4 py-4">
              <div className="skeleton h-40" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
