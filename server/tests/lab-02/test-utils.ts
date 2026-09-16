import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../src/app.js";

// Generate a real hash for "password" so we don't need to mock bcrypt.
export const TEST_PASSWORD_HASH = bcrypt.hashSync("password", 10);

/**
 * Authenticates a requester by calling POST /api/auth/login
 * and returns the agent with the session cookie set.
 */
export async function loginAsRequester(agent: ReturnType<typeof request.agent>, requesterId = 1) {
  const response = await agent
    .post("/api/auth/login")
    .send({ email: `requester${requesterId}@test.com`, password: "password" });
    
  if (response.status !== 200) {
    throw new Error(`loginAsRequester failed with status ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

export function createMockUser(id = 1, role = "REQUESTER") {
  return {
    id,
    email: `requester${id}@test.com`,
    fullName: `Requester ${id}`,
    role,
    passwordHash: TEST_PASSWORD_HASH,
    isActive: true,
    mustChangePassword: false
  };
}
