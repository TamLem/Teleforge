import { useFlowState } from "./useFlowState.js";

export interface ResumeIndicatorProps {
  text?: string;
}

/**
 * Displays a transient banner after a flow has been resumed.
 */
export function ResumeIndicator({ text = "Continuing where you left off" }: ResumeIndicatorProps) {
  const { indicatorVisible, status } = useFlowState();

  if (!indicatorVisible || status !== "resumed") {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        background: "rgba(46, 196, 182, 0.14)",
        border: "1px solid rgba(46, 196, 182, 0.28)",
        borderRadius: "16px",
        color: "#0f3d3a",
        fontSize: "0.95rem",
        fontWeight: 700,
        marginBottom: "12px",
        padding: "12px 14px"
      }}
    >
      {text}
    </div>
  );
}
