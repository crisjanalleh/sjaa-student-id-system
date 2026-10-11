import { SkeletonFilters, SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading batch print…">
      <SkeletonHeader buttons={2} />
      <SkeletonFilters fields={3} />
      <SkeletonList rows={8} />
    </SkeletonPage>
  );
}
