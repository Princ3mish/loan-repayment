import { withApi, ok, readJson } from "@/lib/api.js";
import { validateLoanId, validatePayment } from "@/lib/validation.js";
import { recordPayment } from "@/services/paymentService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(
  async (request, context) => {
    const { id } = await context.params;
    validateLoanId(id);
    const body = await readJson(request);
    const validated = validatePayment(body, request);
    const result = await recordPayment({
      loanId: id,
      ...validated,
    });
    return ok(result, result.replayed ? 200 : 201);
  },
  { rateLimitBucket: "payment" }
);
