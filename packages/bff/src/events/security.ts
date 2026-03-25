export const SessionSecurityEventTypes = {
  REFRESH_TOKEN_REUSE_DETECTED: "security.session.refresh_reuse_detected"
} as const;

export interface SessionRefreshTokenReuseDetectedEvent {
  payload: {
    attemptedAt: number;
    familyId: string;
    sessionId: string;
    tokenSequence: number;
    userId: string;
  };
  timestamp: number;
  type: typeof SessionSecurityEventTypes.REFRESH_TOKEN_REUSE_DETECTED;
}

export type SessionSecurityEvent = SessionRefreshTokenReuseDetectedEvent;

export interface SessionSecurityEventSink {
  emit: (event: SessionSecurityEvent) => Promise<void> | void;
}

export async function emitRefreshTokenReuseDetected(
  sink: SessionSecurityEventSink | null | undefined,
  payload: SessionRefreshTokenReuseDetectedEvent["payload"]
) {
  if (!sink) {
    return;
  }

  await sink.emit({
    payload,
    timestamp: payload.attemptedAt,
    type: SessionSecurityEventTypes.REFRESH_TOKEN_REUSE_DETECTED
  });
}
