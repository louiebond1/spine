"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Composer } from "@/components/ui/Composer";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";

export function DemoComposer() {
  return <Composer allowAttach onSend={async () => {}} trailing={<Button>Mark resolved</Button>} />;
}

export function DemoModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Return with note"
        footer={<Button variant="primary" onClick={() => setOpen(false)}>Return to owner</Button>}
      >
        <TextArea id="demo-note" rows={4} placeholder="What should the owner change?" />
      </Modal>
    </>
  );
}
