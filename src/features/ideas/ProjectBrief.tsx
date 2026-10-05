import { SectionLabel } from "@/components/ui/SectionLabel";

type UseCase = { who: string; scenario: string; outcome: string };

/** The brief from "Start with Spine": real use cases, success measure and scope. */
export function ProjectBrief({
  useCases,
  successMetric,
  mvpScope,
  laterScope,
  hoursSavedEstimate,
}: {
  useCases: unknown;
  successMetric: string | null;
  mvpScope: string | null;
  laterScope: string | null;
  hoursSavedEstimate: number | null;
}) {
  const cases = Array.isArray(useCases) ? (useCases as UseCase[]).filter((u) => u && u.scenario) : [];
  if (!cases.length && !successMetric && !mvpScope) return null;
  return (
    <section className="mb-5 rounded-container border border-border bg-surface px-6 py-5">
      <SectionLabel>The brief</SectionLabel>
      {cases.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-5">
          {cases.map((u, i) => (
            <div key={i} className="rounded-control bg-neutral-soft px-4 py-3">
              <p className="text-label font-semibold text-text">{u.who}</p>
              <p className="mt-1 text-label text-text-muted">{u.scenario}</p>
              <p className="mt-2 text-label text-text">{u.outcome}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 grid grid-cols-3 gap-5 text-label">
        {successMetric && (
          <p className="text-text">
            <span className="font-semibold">Success: </span>
            {successMetric}
            {hoursSavedEstimate ? <span className="text-text-muted"> (about {hoursSavedEstimate} hours a month)</span> : null}
          </p>
        )}
        {mvpScope && (
          <p className="text-text">
            <span className="font-semibold">First version: </span>
            {mvpScope}
          </p>
        )}
        {laterScope && (
          <p className="text-text-muted">
            <span className="font-semibold">Later: </span>
            {laterScope}
          </p>
        )}
      </div>
    </section>
  );
}
