import { SkeletonFormCard, SkeletonHeader, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Opening your admin profile…">
      <SkeletonHeader buttons={0} />
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card animate-pulse flex flex-col items-center p-6">
          <div className="skeleton-block mb-4 h-24 w-24 !rounded-full" />
          <div className="skeleton-block mb-2 h-4 w-32 rounded" />
          <div className="skeleton-block h-3 w-24 rounded" />
        </section>
        <div className="space-y-5 lg:col-span-2">
          <SkeletonFormCard fields={3} button />
          <SkeletonFormCard fields={3} button />
        </div>
      </div>
    </SkeletonPage>
  );
}
