import type { ResumeFlowError } from "@teleforgex/core";

export interface ExpiredFlowViewProps {
  error?: ResumeFlowError | null;
  onFreshStart: () => void;
}

/**
 * Renders a generic fresh-start recovery view for invalid or expired flows.
 */
export function ExpiredFlowView({ error = "expired", onFreshStart }: ExpiredFlowViewProps) {
  const content = getContent(error ?? "expired");

  return (
    <section
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,245,239,0.98))",
        border: "1px solid rgba(24, 41, 47, 0.12)",
        borderRadius: "24px",
        boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
        display: "grid",
        gap: "12px",
        padding: "20px"
      }}
    >
      <div style={{ display: "grid", gap: "6px" }}>
        <strong style={{ color: "#18292f", fontSize: "1rem" }}>{content.title}</strong>
        <p style={{ color: "#465a63", lineHeight: 1.5, margin: 0 }}>{content.message}</p>
      </div>
      <button
        onClick={onFreshStart}
        style={{
          background: "#18292f",
          border: "none",
          borderRadius: "999px",
          color: "#fdf7ec",
          cursor: "pointer",
          fontWeight: 700,
          padding: "12px 16px"
        }}
        type="button"
      >
        {content.cta}
      </button>
    </section>
  );
}

function getContent(error: ResumeFlowError) {
  if (error === "completed") {
    return {
      cta: "Start new flow",
      message: "This flow is already complete. Start a new one if you want to continue.",
      title: "Already completed"
    };
  }

  if (error === "invalid") {
    return {
      cta: "Start fresh",
      message: "This flow can no longer be resumed from your current session.",
      title: "This flow is no longer available"
    };
  }

  if (error === "invalid_step") {
    return {
      cta: "Start fresh",
      message: "We could not place you back into this flow, so the safest path is to start over.",
      title: "We couldn't restore this step"
    };
  }

  if (error === "not_found") {
    return {
      cta: "Start fresh",
      message: "The saved flow could not be found. Start again to continue.",
      title: "No saved session found"
    };
  }

  return {
    cta: "Start fresh",
    message: "This session expired before it could be resumed. Start again to keep going.",
    title: "This session expired"
  };
}
