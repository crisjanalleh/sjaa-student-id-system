import { SkeletonFilters, SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading audit trail…">
      <SkeletonHeader buttons={0} />
      <SkeletonFilters fields={4} />
      <SkeletonList rows={10} avatar={false} />
    </SkeletonPage>
  );
}
