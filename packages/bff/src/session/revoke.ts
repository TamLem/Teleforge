import type { RevokeInput, RevokeOutput, SessionConfig } from "./types.js";
import type { BffHandler } from "../route/types.js";

export function createSessionRevokeHandler(
  options: SessionConfig
): BffHandler<RevokeInput, RevokeOutput> {
  return async (context, input) => {
    const sessionId = context.auth.sessionId;
    const appUserId = context.identity?.appUserId;

    if (input?.all && appUserId) {
      await options.adapter.revokeAllUserSessions(appUserId);
    } else if (sessionId) {
      await options.adapter.revokeSession(sessionId);
    }

    return {
      revoked: true,
      sessionId
    };
  };
}
