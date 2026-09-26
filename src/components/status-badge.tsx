import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

const STYLES: Record<OrderStatus, string> = {
  paid: "bg-nozzle/25 text-ink",
  printing: "bg-filament/15 text-filament-dark",
  shipped: "bg-ok/15 text-ok",
  delivered: "bg-plate text-muted",
  cancelled: "bg-danger/10 text-danger",
};

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  const label = ORDER_STATUSES.find((x) => x.value === s)?.label ?? status;
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[s] ?? ""}`}>{label}</span>;
}
