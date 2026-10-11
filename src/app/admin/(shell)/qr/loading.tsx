import { SkeletonFormCard, SkeletonHeader, SkeletonList, SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage label="Loading QR codes…">
      <SkeletonHeader buttons={0} />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SkeletonFormCard fields={2} button />
        <SkeletonList rows={6} avatar={false} />
      </div>
    </SkeletonPage>
  );
}
