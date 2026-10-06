import { generateSchedule } from "@/services/scheduleService.js";

export async function getIdToken() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });

  const data = await res.json();
  if (!res.ok || !data.idToken) {
    throw new Error(
      `Failed to authenticate test user with Firebase: ${JSON.stringify(data)}`
    );
  }
  return data.idToken;
}

export function makeRequest(
  url,
  { method = "GET", token, body, headers = {} } = {}
) {
  const reqHeaders = new Headers(headers);
  if (token) {
    reqHeaders.set("Authorization", `Bearer ${token}`);
  }
  let reqBody = undefined;
  if (body !== undefined) {
    reqHeaders.set("Content-Type", "application/json");
    reqBody = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new Request(
    url.startsWith("http") ? url : `http://localhost:3000${url}`,
    {
      method,
      headers: reqHeaders,
      body: reqBody,
    }
  );
}

export function params(id) {
  return { params: Promise.resolve({ id }) };
}

export function buildInstallments(scheduleArgs) {
  const { installments } = generateSchedule(scheduleArgs);
  return installments.map((inst, index) => ({
    id: `i${index + 1}`,
    installmentNumber: inst.installmentNumber,
    dueDate: inst.dueDate,
    principalDuePaise: inst.principalDuePaise,
    interestDuePaise: inst.interestDuePaise,
    totalDuePaise: inst.totalDuePaise,
    principalPaidPaise: 0,
    interestPaidPaise: 0,
    lastPaymentDate: null,
  }));
}

export function applyAllocations(installments, allocations, paymentDate) {
  const allocMap = new Map();
  for (const a of allocations) {
    allocMap.set(a.installmentId, a);
  }

  return installments.map((inst) => {
    const alloc = allocMap.get(inst.id);
    if (!alloc) return { ...inst };
    return {
      ...inst,
      principalPaidPaise: inst.principalPaidPaise + alloc.principalPaise,
      interestPaidPaise: inst.interestPaidPaise + alloc.interestPaise,
      lastPaymentDate: paymentDate,
    };
  });
}
