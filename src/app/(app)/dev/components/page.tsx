import { notFound } from "next/navigation";
import { Clock, FileText } from "lucide-react";
import { Page } from "@/components/shell/Shell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Container } from "@/components/ui/Container";
import { Row } from "@/components/ui/Row";
import { IconTile } from "@/components/ui/IconTile";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { NumberField } from "@/components/ui/NumberField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Stepper } from "@/components/ui/Stepper";
import { LiveDot } from "@/components/ui/LiveDot";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { MetaLine } from "@/components/ui/MetaLine";
import { Timeline } from "@/components/ui/Timeline";
import { ChatMessage } from "@/components/ui/ChatMessage";
import { EmptyState, SkeletonRows } from "@/components/ui/States";
import { DemoComposer, DemoModal } from "./demos";

// Dev-only gallery of every shared component, for review in Phase 1. Never served in production.
export default function ComponentsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <Page>
      <PageHeader date="Component gallery" title="Shared components" />
      <div className="space-y-6">
        <Container heading="Rows" count={2} action={<Button variant="text" href="#" arrow>View all</Button>}>
          <Row
            leading={<IconTile icon={FileText} />}
            title="Supplier Research Assistant"
            meta={<p className="text-meta text-text-muted">Auto-approves in <strong className="font-semibold text-text">6h</strong> unless you review it</p>}
            trailing={<Button variant="primary" arrow href="#">Review</Button>}
          />
          <Row
            leading={<IconTile icon={Clock} />}
            title="Best way to anonymise client data?"
            meta={<MetaLine parts={["Ben Carter", "Security", "2h ago"]} />}
            trailing={<Button arrow href="#">Claim</Button>}
          />
          <Row leading={<Avatar initials={null} />} title="Is Claude allowed to access client information?" meta={<MetaLine parts={["Anonymous", "Security", "4h ago"]} />} />
          <Row highlighted leading={<Avatar initials="AM" />} title="Alex Morgan" trailing={<span className="text-meta text-text">6</span>} />
          <Row density="compact" title="Claude Onboarding Guide" meta={<p className="flex items-center gap-2 text-meta text-text-muted"><LiveDot /> Live · 14 hours saved this month</p>} />
        </Container>

        <Container label="Buttons and tabs">
          <div className="flex flex-wrap items-center gap-4 py-5">
            <Button variant="primary" arrow>Primary</Button>
            <Button arrow>Secondary</Button>
            <Button variant="text" arrow>Text link</Button>
          </div>
          <div className="py-5">
            <Tabs
              active="open"
              tabs={[
                { key: "open", label: "Open", href: "#" },
                { key: "mine", label: "Mine", href: "#", count: 2 },
                { key: "resolved", label: "Resolved", href: "#" },
              ]}
            />
          </div>
          <div className="flex gap-6 py-5">
            <SegmentedToggle active="pipeline" options={[{ key: "pipeline", label: "Pipeline", href: "#" }, { key: "list", label: "List", href: "#" }]} />
            <SegmentedToggle size="sm" active="hours" options={[{ key: "hours", label: "Hours saved", href: "#" }, { key: "value", label: "Estimated value", href: "#" }]} />
          </div>
        </Container>

        <Container label="Form controls">
          <div className="grid grid-cols-2 gap-5 py-5">
            <TextField id="d-name" label="Name your idea" defaultValue="Supplier Risk Checker" />
            <Select id="d-topic" label="Topic" defaultValue="procurement" options={[{ value: "procurement", label: "Procurement" }]} />
            <div className="col-span-2">
              <TextArea id="d-problem" label="What problem does it solve?" />
            </div>
            <TextField search placeholder="Search questions..." />
            <span className="flex items-center gap-6">
              <NumberField defaultValue={7} suffix="days" />
              <Checkbox label="Ask anonymously" />
              <Checkbox defaultChecked label="Champion" />
            </span>
          </div>
        </Container>

        <Container label="Progress and stages">
          <div className="space-y-6 py-5">
            <Stepper steps={["Idea", "Approval", "Recruiting", "Building", "Publishing", "Live"]} current={3} />
            <div className="w-48"><ProgressBar value={6} max={9} /></div>
          </div>
        </Container>

        <Container label="Timeline and chat">
          <div className="grid grid-cols-2 gap-6 py-5">
            <Timeline tone="brand" items={[{ key: "a", text: "Sarah Kim posted the question", time: "2h ago" }, { key: "b", text: "You claimed it", time: "1h ago" }]} />
            <Timeline items={[{ key: "a", text: "Submitted by Louie Morris", time: "30 Sep at 16:00" }, { key: "b", text: "Auto-approves today at 16:00" }]} />
          </div>
          <div className="space-y-6 py-5">
            <ChatMessage author="Sarah Kim" initials="SK" time="18m ago" body="I've attached a sample file." attachments={[{ id: "1", fileName: "Sales_Data_Sample.xlsx", size: "240 KB", href: "#" }]} />
            <ChatMessage author="Alex Morgan" initials="AM" time="1h ago" mine body="Yes, you can." />
            <ChatMessage author="" initials={null} time="" system body="Mia completed Fix edge cases from testing" />
          </div>
          <div className="py-5">
            <DemoComposer />
          </div>
        </Container>

        <Container label="States and modal">
          <EmptyState>Nothing needs you right now</EmptyState>
          <SkeletonRows count={2} />
          <div className="py-5">
            <DemoModal />
          </div>
        </Container>
      </div>
    </Page>
  );
}
