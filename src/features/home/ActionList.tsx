import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { IconTile } from "@/components/ui/IconTile";
import { Button } from "@/components/ui/Button";

export type ActionItem = {
  key: string;
  icon: LucideIcon;
  title: string;
  reason: React.ReactNode;
  href: string;
  /** Custom action control (e.g. the Claim form). Defaults to a link button. */
  action?: (variant: "primary" | "secondary") => React.ReactNode;
  actionLabel?: string;
};

/** Home's needs-you list and Pulse share this row style. The top item gets the only primary button. */
export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <Container>
      {items.map((item, i) => {
        const variant = i === 0 ? "primary" : "secondary";
        return (
          <Row
            key={item.key}
            gap="wide"
            leading={<IconTile icon={item.icon} />}
            title={item.title}
            href={item.href}
            meta={<p className="text-meta text-text-muted">{item.reason}</p>}
            trailing={
              item.action
                ? item.action(variant)
                : item.actionLabel && (
                    <Button href={item.href} variant={variant} arrow className="min-w-action">
                      {item.actionLabel}
                    </Button>
                  )
            }
          />
        );
      })}
    </Container>
  );
}
