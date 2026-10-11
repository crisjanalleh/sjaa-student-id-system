import { SkeletonFilters, SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading notifications…">
      <SkeletonHeader buttons={1} />
      <SkeletonFilters fields={2} />
      <SkeletonList rows={8} title={false} />
    </SkeletonPage>
  );
}
