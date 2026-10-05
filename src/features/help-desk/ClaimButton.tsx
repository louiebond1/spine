import { claimQuestion } from "@/server/questions/actions";
import { Button } from "@/components/ui/Button";

/** Claims the question on the server, then opens the thread. */
export function ClaimButton({ questionId, variant = "secondary", arrow }: { questionId: string; variant?: "primary" | "secondary"; arrow?: boolean }) {
  return (
    <form action={claimQuestion.bind(null, questionId)}>
      <Button type="submit" variant={variant} arrow={arrow} className="min-w-action">
        Claim
      </Button>
    </form>
  );
}
