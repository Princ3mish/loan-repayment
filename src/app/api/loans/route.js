import { withApi, ok, readJson } from "@/lib/api.js";
import { validateCreateLoan } from "@/lib/validation.js";
import { createLoan, getLoanDetail, listLoans } from "@/services/loanService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withApi(
  async (request) => {
    const body = await readJson(request);
    const validated = validateCreateLoan(body);
    const loanId = await createLoan(validated);
    const detail = await getLoanDetail(loanId);
    return ok(detail, 201);
  },
  { rateLimitBucket: "write" }
);

export const GET = withApi(
  async () => {
    const loans = await listLoans();
    return ok({ loans });
  },
  { rateLimitBucket: "read" }
);
