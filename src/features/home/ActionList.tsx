import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { IconTile } from "@/components/ui/IconTile";
import { Button } from "@/components/ui/Button";

export type ActionItem = {
  key: string;
  icon: LucideIcon;
  tone?: "neutral" | "critical" | "warning" | "brand";
  title: string;
  reason: React.ReactNode;
  href: string;
  actionLabel?: string;
};

/** Home's needs-you list and Pulse share this row style. The top item gets the only primary button. */
export function ActionList({ items, heading, count, primaryFirst = true }: { items: ActionItem[]; heading?: string; count?: number; primaryFirst?: boolean }) {
  return (
    <Container heading={heading} count={count}>
      {items.map((item, i) => (
        <Row
          key={item.key}
          leading={<IconTile icon={item.icon} tone={item.tone} />}
          title={item.title}
          href={item.href}
          meta={<p className="text-label text-text-muted">{item.reason}</p>}
          trailing={
            item.actionLabel && (
              <Button href={item.href} variant={primaryFirst && i === 0 ? "primary" : "secondary"} size="sm" className="ml-14 sm:ml-0">
                {item.actionLabel}
              </Button>
            )
          }
        />
      ))}
    </Container>
  );
}
