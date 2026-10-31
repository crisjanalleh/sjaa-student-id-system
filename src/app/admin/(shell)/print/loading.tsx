import { SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading batch print…">
      <SkeletonHeader buttons={2} />
      <div className="space-y-6">
        <SkeletonList rows={8} />
        <SkeletonList rows={4} pager={false} />
      </div>
    </SkeletonPage>
  );
}
