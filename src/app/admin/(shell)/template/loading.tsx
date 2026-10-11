import { SkeletonCardPreview, SkeletonFormCard, SkeletonHeader, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading ID template…">
      <SkeletonHeader buttons={2} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <SkeletonFormCard fields={4} button={false} />
          <SkeletonFormCard fields={3} button />
        </div>
        <SkeletonCardPreview />
      </div>
    </SkeletonPage>
  );
}
