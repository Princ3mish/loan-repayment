import { getAdminAuth } from "./firebaseAdmin.js";
import { ApiError } from "./api.js";

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
    const decoded = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email || null,
    };
  } catch {
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "A valid Firebase ID token is required"
    );
  }
}
