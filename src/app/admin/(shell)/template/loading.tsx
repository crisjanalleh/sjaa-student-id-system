import { SkeletonCardPreview, SkeletonFormCard, SkeletonHeader, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading ID template…">
      <SkeletonHeader buttons={1} />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SkeletonFormCard fields={6} button />
        </div>
        <div className="grid gap-5 lg:col-span-3 2xl:grid-cols-2">
          <SkeletonCardPreview />
          <SkeletonCardPreview />
        </div>
      </div>
    </SkeletonPage>
  );
}
