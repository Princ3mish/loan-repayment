import { withApi, ok } from "@/lib/api.js";
import { validateLoanId } from "@/lib/validation.js";
import { getLoanDetail } from "@/services/loanService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withApi(
  async (request, context) => {
    const { id } = await context.params;
    validateLoanId(id);
    const detail = await getLoanDetail(id);
    return ok(detail);
  },
  { rateLimitBucket: "read" }
);
