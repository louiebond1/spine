"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Field";
import { ICON_STROKE } from "@/components/ui/icons";
import { setChannelLink } from "@/server/projects/actions";

/**
 * Where the team actually talks. Spine links an existing Teams or Slack channel rather than
 * hosting its own chat or creating a channel per initiative.
 */
export function ChannelLink({ projectId, url, platform, canEdit }: { projectId: string; url: string | null; platform: "Teams" | "Slack" | null; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (editing) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste a Teams or Slack channel link" className={controlClass + " h-8 w-full text-label sm:w-80"} aria-label="Channel link" />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setChannelLink(projectId, value);
                if (!r.ok) return setError(r.error);
                setEditing(false);
                router.refresh();
              })
            }
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {error && <p className="text-label text-critical">{error}</p>}
      </div>
    );
  }
  if (url) {
    return (
      <span className="flex items-center gap-1">
        <Button size="sm" href={url} icon={ExternalLink}>
          {platform ? `Open ${platform} channel` : "Open channel"}
        </Button>
        {canEdit && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            Change
          </Button>
        )}
      </span>
    );
  }
  return canEdit ? (
    <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-label font-medium text-text-muted hover:text-text">
      <Link2 size={14} strokeWidth={ICON_STROKE} aria-hidden />
      Link your Teams or Slack channel
    </button>
  ) : null;
}
