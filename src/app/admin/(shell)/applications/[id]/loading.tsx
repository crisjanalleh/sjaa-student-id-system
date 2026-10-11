import { SkeletonCardPreview, SkeletonFormCard, SkeletonHeader, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading application…">
      <SkeletonHeader buttons={2} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <SkeletonFormCard fields={5} button={false} />
          <SkeletonFormCard fields={3} button />
        </div>
        <div className="space-y-5">
          <SkeletonCardPreview />
          <SkeletonFormCard fields={2} button />
        </div>
      </div>
    </SkeletonPage>
  );
}
