import { SkeletonFilters, SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading applications…">
      <SkeletonHeader buttons={1} />
      <SkeletonFilters fields={4} />
      <SkeletonList rows={10} />
    </SkeletonPage>
  );
}
