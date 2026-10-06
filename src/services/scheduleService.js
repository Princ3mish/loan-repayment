import { addMonths } from "../lib/dates.js";

export function calculateEmiPaise(principalPaise, annualRateBps, tenureMonths) {
  const r = annualRateBps / 10000 / 12;
  let rawEmi;
  if (r === 0) {
    rawEmi = principalPaise / tenureMonths;
  } else {
    const compound = Math.pow(1 + r, tenureMonths);
    rawEmi = (principalPaise * r * compound) / (compound - 1);
  }
  return Math.round(rawEmi / 100) * 100;
}

export function generateSchedule({
  principalPaise,
  annualRateBps,
  tenureMonths,
  disbursementDate,
}) {
  const emiPaise = calculateEmiPaise(
    principalPaise,
    annualRateBps,
    tenureMonths
  );
  const r = annualRateBps / 10000 / 12;
  const installments = [];
  let balance = principalPaise;

  for (let i = 1; i <= tenureMonths; i++) {
    const openingBalancePaise = balance;
    const interestDuePaise = Math.round(openingBalancePaise * r);
    let principalDuePaise;

    if (i < tenureMonths) {
      principalDuePaise = emiPaise - interestDuePaise;
    } else {
      principalDuePaise = openingBalancePaise;
    }

    if (principalDuePaise < 0) {
      throw new Error("SCHEDULE_INVARIANT_FAILED");
    }

    const totalDuePaise = principalDuePaise + interestDuePaise;
    const closingBalancePaise = openingBalancePaise - principalDuePaise;
    balance = closingBalancePaise;

    const dueDate = addMonths(disbursementDate, i);

    installments.push({
      installmentNumber: i,
      dueDate,
      principalDuePaise,
      interestDuePaise,
      totalDuePaise,
      openingBalancePaise,
      closingBalancePaise,
    });
  }

  const sumPrincipal = installments.reduce(
    (sum, inst) => sum + inst.principalDuePaise,
    0
  );

  if (balance !== 0 || sumPrincipal !== principalPaise) {
    throw new Error("SCHEDULE_INVARIANT_FAILED");
  }

  return {
    emiPaise,
    installments,
  };
}
