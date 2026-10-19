import { claimQuestion } from "@/server/questions/actions";
import { Button } from "@/components/ui/Button";

/** Claims the question on the server, then opens the thread. */
export function ClaimButton({ questionId, variant = "secondary" }: { questionId: string; variant?: "primary" | "secondary" }) {
  return (
    <form action={claimQuestion.bind(null, questionId)}>
      <Button type="submit" variant={variant} size="sm">
        Claim
      </Button>
    </form>
  );
}
