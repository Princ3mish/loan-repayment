export function allocatePayment({ installments, amountPaise, paymentDate }) {
  if (
    typeof amountPaise !== "number" ||
    !Number.isInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error("INVALID_AMOUNT");
  }

  const sortedInstallments = [...installments].sort(
    (a, b) => a.installmentNumber - b.installmentNumber
  );

  const totalOutstandingPaise = sortedInstallments.reduce((sum, inst) => {
    const interestOutstanding = inst.interestDuePaise - inst.interestPaidPaise;
    const principalOutstanding =
      inst.principalDuePaise - inst.principalPaidPaise;
    return sum + interestOutstanding + principalOutstanding;
  }, 0);

  if (totalOutstandingPaise === 0) {
    throw new Error("LOAN_ALREADY_CLOSED");
  }

  if (amountPaise > totalOutstandingPaise) {
    throw new Error("PAYMENT_EXCEEDS_OUTSTANDING");
  }

  let remaining = amountPaise;
  const allocations = [];

  for (const inst of sortedInstallments) {
    if (remaining === 0) {
      break;
    }

    const interestOutstanding = inst.interestDuePaise - inst.interestPaidPaise;
    const principalOutstanding =
      inst.principalDuePaise - inst.principalPaidPaise;

    if (interestOutstanding <= 0 && principalOutstanding <= 0) {
      continue;
    }

    const interestAllocated = Math.min(remaining, interestOutstanding);
    remaining -= interestAllocated;

    const principalAllocated = Math.min(remaining, principalOutstanding);
    remaining -= principalAllocated;

    if (interestAllocated > 0 || principalAllocated > 0) {
      allocations.push({
        installmentId: inst.id,
        installmentNumber: inst.installmentNumber,
        interestPaise: interestAllocated,
        principalPaise: principalAllocated,
        isLate: paymentDate > inst.dueDate,
      });
    }
  }

  const totalAllocatedPaise = allocations.reduce(
    (sum, a) => sum + a.interestPaise + a.principalPaise,
    0
  );

  if (totalAllocatedPaise !== amountPaise) {
    throw new Error("ALLOCATION_INVARIANT_FAILED");
  }

  return {
    allocations,
    totalAllocatedPaise,
  };
}
