import { CheckCircle2, Clock3, IdCard, Printer, XCircle } from "lucide-react";
import { STATUS_LABELS } from "@/lib/fields";

const STATUS_ICON: Record<string, typeof Clock3> = {
  pending: Clock3,
  approved: CheckCircle2,
  rejected: XCircle,
  printed: Printer,
  claimed: IdCard,
};

export default function StatusBadge({ status }: { status: string }) {
  const Icon = STATUS_ICON[status] || Clock3;
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`badge badge-${status}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}
