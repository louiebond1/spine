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
    <section className="rounded-container border border-border bg-surface p-4 sm:p-5">
      <SectionLabel>The brief</SectionLabel>
      {cases.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {cases.map((u, i) => (
            <div key={i} className="rounded-control bg-subtle px-3 py-2.5">
              <p className="text-label font-semibold text-text">{u.who}</p>
              <p className="mt-1 text-label text-text-muted">{u.scenario}</p>
              <p className="mt-2 text-label text-text">{u.outcome}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 grid gap-3 text-label sm:grid-cols-3">
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
