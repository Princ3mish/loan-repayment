import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "./api.js";

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

function getFirebaseProjectId() {
  let id = (process.env.FIREBASE_PROJECT_ID || "").trim();
  if (
    (id.startsWith('"') && id.endsWith('"')) ||
    (id.startsWith("'") && id.endsWith("'"))
  ) {
    id = id.slice(1, -1).trim();
  }
  return id;
}

export async function requireAuth(request) {
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "A valid Firebase ID token is required"
    );
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "A valid Firebase ID token is required"
    );
  }

  try {
    const projectId = getFirebaseProjectId();
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== "string" ||
      !payload.sub.trim() ||
      typeof payload.auth_time !== "number" ||
      payload.auth_time > nowSeconds
    ) {
      throw new Error("Invalid token claims");
    }

    return {
      uid: payload.sub,
      email: payload.email || null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error(
      JSON.stringify({
        event: "auth.failed",
        reason: error.code || error.message,
      })
    );
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "A valid Firebase ID token is required"
    );
  }
}
