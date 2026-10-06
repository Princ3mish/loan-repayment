import { auth } from "./firebaseClient.js";

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, headers = {} } = options;

  let token = null;
  if (auth.currentUser) {
    try {
      token = await auth.currentUser.getIdToken();
    } catch {
      token = null;
    }
  }

  const reqHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers: reqHeaders,
      body:
        body !== undefined
          ? typeof body === "string"
            ? body
            : JSON.stringify(body)
          : undefined,
    });
  } catch (err) {
    const error = new Error(err?.message || "Network error");
    error.status = 0;
    error.code = "NETWORK_ERROR";
    error.details = undefined;
    throw error;
  }

  let json;
  try {
    json = await res.json();
  } catch {
    const error = new Error("Failed to parse JSON response");
    error.status = res.status;
    error.code = "NETWORK_ERROR";
    error.details = undefined;
    throw error;
  }

  if (json && json.success === true) {
    return { status: res.status, data: json.data };
  }

  const error = new Error(json?.error?.message || "Request failed");
  error.status = res.status;
  error.code = json?.error?.code || "API_ERROR";
  error.details = json?.error?.details;
  throw error;
}
