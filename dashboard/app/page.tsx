"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import type { PendingAction } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: number;
  timestamp: string;
  action: string;
  actor: string;
  subject_hash: string | null;
  hash: string;
  prev_hash: string;
}

interface VerifyResult {
  id: number;
  action: string;
  actor: string;
  timestamp: string;
  hashSnippet: string;
  prevHashSnippet: string;
  status: "pass" | "fail" | "untrusted";
  computedHash?: string;
}

interface VerifyResponse {
  total: number;
  passed: number;
  failed: number;
  chainIntact: boolean;
  results: VerifyResult[];
}

interface Toast {
  id: string;
  type: "error" | "warning" | "success";
  message: string;
}

// ---------------------------------------------------------------------------
// ToastContainer
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          id={`toast-${t.id}`}
          className={`toast toast-${t.type}`}
          onClick={() => onDismiss(t.id)}
          style={{ cursor: "pointer" }}
        >
          <span>{t.type === "error" ? "✗" : t.type === "warning" ? "⚠" : "✓"}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VerifyModal
// ---------------------------------------------------------------------------

function VerifyModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<"counting" | "done">("counting");
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch("/api/verify-integrity");
        const json: VerifyResponse = await res.json();
        if (cancelled) return;
        setTotal(json.total);

        // Animate counter up to total
        let i = 0;
        const step = Math.max(1, Math.floor(json.total / 20));
        const timer = setInterval(() => {
          i = Math.min(i + step, json.total);
          setCount(i);
          if (i >= json.total) {
            clearInterval(timer);
            if (!cancelled) {
              setData(json);
              setPhase("done");
            }
          }
        }, 60);
      } catch {
        if (!cancelled) setPhase("done");
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      id="verify-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="verify-modal"
        className="glass-card animate-fadein"
        style={{
          padding: 32,
          width: "min(700px, 93vw)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              🔐 Audit Chain Verification
            </h3>
            <p
              style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}
            >
              Walking SHA-256 hash chain entry by entry
            </p>
          </div>
          <button
            id="verify-modal-close"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: 22,
              lineHeight: 1,
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* Counting phase */}
        {phase === "counting" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div
              className="verify-counting"
              style={{
                fontSize: 36,
                fontFamily: "JetBrains Mono, monospace",
                fontWeight: 700,
                color: "#818cf8",
              }}
            >
              {count}/{total > 0 ? total : "…"} entries checked
            </div>
            <div
              style={{ marginTop: 14, color: "var(--text-secondary)", fontSize: 13 }}
            >
              Verifying hash chain integrity…
            </div>
          </div>
        )}

        {/* Done phase */}
        {phase === "done" && data && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* Result banner */}
            <div
              id={data.chainIntact ? "verify-result-pass" : "verify-result-fail"}
              style={{
                padding: "18px 22px",
                borderRadius: 10,
                marginBottom: 20,
                background: data.chainIntact
                  ? "rgba(16, 185, 129, 0.10)"
                  : "rgba(244, 63, 94, 0.10)",
                border: `1px solid ${
                  data.chainIntact
                    ? "rgba(16,185,129,0.3)"
                    : "rgba(244,63,94,0.3)"
                }`,
              }}
            >
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: data.chainIntact ? "#10b981" : "#f43f5e",
                  marginBottom: 6,
                }}
              >
                {data.chainIntact ? "✓ Chain Intact" : "✗ Tampering Detected"}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {data.total} entries verified · {data.passed} passed ·{" "}
                {data.failed} failed
              </div>
              {!data.chainIntact && (
                <div
                  style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}
                >
                  ⚠ One or more entries have been tampered with. All subsequent
                  entries are marked untrusted.
                </div>
              )}
            </div>

            {/* Collapsible entry list */}
            <button
              id="verify-entries-toggle"
              className="btn-secondary"
              style={{ width: "100%", marginBottom: 12, textAlign: "left" }}
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? "▲ Hide entries" : "▼ Show all entries"} ({data.total})
            </button>

            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {data.results.map((r) => (
                  <div
                    key={r.id}
                    className="audit-feed-entry"
                    style={{
                      background:
                        r.status === "fail"
                          ? "rgba(244,63,94,0.08)"
                          : "transparent",
                      border:
                        r.status === "fail"
                          ? "1px solid rgba(244,63,94,0.25)"
                          : "1px solid transparent",
                      borderRadius: 6,
                    }}
                  >
                    <span className={`verify-entry-${r.status}`}>
                      {r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "?"}
                    </span>
                    <span
                      style={{ color: "var(--text-muted)", minWidth: 36, fontSize: 11 }}
                    >
                      #{r.id}
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        minWidth: 160,
                        fontSize: 11,
                      }}
                    >
                      {r.action}
                    </span>
                    <span
                      style={{
                        fontFamily: "JetBrains Mono, monospace",
                        color: "var(--text-muted)",
                        fontSize: 10,
                        flex: 1,
                      }}
                    >
                      {r.hashSnippet}…
                    </span>
                    {r.status === "fail" && r.computedHash && (
                      <span style={{ fontSize: 10, color: "#f43f5e" }}>
                        expected: {r.computedHash}…
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Done phase — no data (error) */}
        {phase === "done" && !data && (
          <div
            style={{ textAlign: "center", padding: "40px 0", color: "#f43f5e" }}
          >
            Verification failed. Check dashboard logs.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AuditFeed
// ---------------------------------------------------------------------------

const ACTION_COLOR: Record<string, string> = {
  SCAN: "#818cf8",
  APPROVAL_REQUESTED: "#f59e0b",
  APPROVED: "#10b981",
  DENIED: "#f43f5e",
  EXECUTION_STARTED: "#60a5fa",
  SNAPSHOT_TAKEN: "#a78bfa",
  EXECUTION_COMPLETED: "#34d399",
  EXECUTION_FAILED: "#f87171",
  EXECUTED: "#34d399",
  ROLLBACK_COMPLETED: "#fb923c",
  ROLLED_BACK: "#fb923c",
};

function AuditFeed({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          color: "var(--text-muted)",
          fontSize: 13,
          textAlign: "center",
          padding: "20px 0",
        }}
      >
        No audit entries yet. Run scan_subject via MCP to generate entries.
      </div>
    );
  }

  return (
    <div
      id="audit-log-feed"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxHeight: 200,
        overflowY: "auto",
      }}
    >
      {entries.map((e) => (
        <div key={e.id} className="audit-feed-entry">
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              color: ACTION_COLOR[e.action] ?? "var(--text-secondary)",
              minWidth: 170,
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {e.action}
          </span>
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 10,
              minWidth: 100,
            }}
          >
            {e.actor}
          </span>
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              color: "var(--text-muted)",
              flex: 1,
            }}
          >
            {String(e.hash).slice(0, 8)}…
          </span>
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 10,
              whiteSpace: "nowrap",
            }}
          >
            {new Date(e.timestamp).toLocaleTimeString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: PendingAction["status"] }) {
  const classes = {
    pending: "badge badge-pending",
    approved: "badge badge-approved",
    denied: "badge badge-denied",
    executed: "badge badge-approved",
    rolled_back: "badge badge-denied",
  };

  const dot = status === "pending" ? "pulse-dot" : "";

  return (
    <span className={classes[status as keyof typeof classes] || "badge"}>
      <span
        className={dot}
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
        }}
      />
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// RiskBadge
// ---------------------------------------------------------------------------

function RiskBadge({ risk }: { risk: string }) {
  const colorClass =
    (
      {
        CRITICAL: "risk-critical",
        HIGH: "risk-high",
        MEDIUM: "risk-medium",
        LOW: "risk-low",
      } as Record<string, string>
    )[risk] ?? "risk-low";

  return (
    <span
      className={colorClass}
      style={{
        fontWeight: 700,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {risk}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ConfirmModal
// ---------------------------------------------------------------------------

function ConfirmModal({
  action,
  resolution,
  onConfirm,
  onCancel,
  loading,
}: {
  action: PendingAction;
  resolution: "approve" | "deny";
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const isApprove = resolution === "approve";
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        className="glass-card animate-fadein"
        style={{ padding: 32, maxWidth: 440, width: "90%" }}
      >
        <h3
          style={{
            margin: "0 0 8px",
            fontSize: 18,
            fontWeight: 700,
            color: isApprove ? "#10b981" : "#f43f5e",
          }}
        >
          {isApprove ? "✓ Confirm Approval" : "✗ Confirm Denial"}
        </h3>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px" }}>
          {isApprove
            ? "This will authorize the deletion/anonymization. This action cannot be undone."
            : "This will deny the request. A new scan must be run to re-submit."}
        </p>
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
            fontSize: 13,
          }}
        >
          <div style={{ color: "var(--text-secondary)", marginBottom: 4 }}>Scan ID</div>
          <div
            style={{
              fontFamily: "JetBrains Mono, monospace",
              color: "var(--text-primary)",
              fontSize: 12,
            }}
          >
            {action.scanId}
          </div>
          <div style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 4 }}>
            Action
          </div>
          <div style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>
            {action.action}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button
            className={isApprove ? "btn-approve" : "btn-deny"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing…" : isApprove ? "Approve" : "Deny"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailPanel
// ---------------------------------------------------------------------------

function DetailPanel({
  action,
  onApprove,
  onDeny,
  onRollbackError,
}: {
  action: PendingAction;
  onApprove: (token: string) => void;
  onDeny: (token: string) => void;
  onRollbackError: (msg: string) => void;
}) {
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackError, setRollbackError] = useState<string | null>(null);
  const isPending = action.status === "pending";

  async function handleRollback() {
    if (
      !confirm(
        "Are you sure you want to rollback this execution? Data will be restored from snapshots."
      )
    )
      return;

    setRollbackLoading(true);
    setRollbackError(null);
    try {
      const res = await fetch(`/api/approvals/${action.token}/rollback`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Rollback failed");
      }
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Rollback failed";
      setRollbackError(msg);
      onRollbackError(msg);
    } finally {
      setRollbackLoading(false);
    }
  }

  return (
    <div
      className="animate-fadein"
      style={{ height: "100%", overflowY: "auto", padding: "0 0 40px" }}
    >
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <StatusBadge status={action.status} />
          <span
            style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 11,
              color: "var(--text-muted)",
            }}
          >
            {action.token.slice(0, 16)}…
          </span>
        </div>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
          {action.action === "delete" ? "Data Deletion" : "Data Anonymization"} Request
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 13 }}>
          Requested {new Date(action.requestedAt).toLocaleString()}
        </p>
      </div>

      {/* Scan ID */}
      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Scan ID
        </div>
        <code
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 12,
            color: "#93c5fd",
          }}
        >
          {action.scanId}
        </code>
      </div>

      {/* Action */}
      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Requested Action
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, textTransform: "capitalize" }}>
          {action.action === "delete" ? "🗑 Delete all records" : "🔒 Anonymize all records"}
        </div>
      </div>

      {/* Resolution */}
      {action.resolvedAt && (
        <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-secondary)",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Resolution
          </div>
          <div style={{ fontSize: 13 }}>
            <StatusBadge status={action.status} />
            <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
              by {action.resolvedBy} on {new Date(action.resolvedAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {isPending && (
        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button
            id="approve-btn"
            className="btn-approve"
            style={{ flex: 1, padding: "12px 0" }}
            onClick={() => onApprove(action.token)}
          >
            ✓ Approve
          </button>
          <button
            id="deny-btn"
            className="btn-deny"
            style={{ flex: 1, padding: "12px 0" }}
            onClick={() => onDeny(action.token)}
          >
            ✗ Deny
          </button>
        </div>
      )}

      {/* Already Resolved Notice */}
      {!isPending && (
        <div
          style={{
            marginTop: 24,
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            color: "var(--text-secondary)",
            fontSize: 13,
          }}
        >
          This request has been{" "}
          <strong
            style={{
              color:
                action.status === "approved"
                  ? "#10b981"
                  : action.status === "executed"
                  ? "#3b82f6"
                  : "#f43f5e",
            }}
          >
            {action.status}
          </strong>
          .
        </div>
      )}

      {/* Rollback Button for Executed Actions */}
      {action.status === "executed" && (
        <div style={{ marginTop: 16 }}>
          <button
            id="rollback-btn"
            disabled={rollbackLoading}
            style={{
              width: "100%",
              padding: "12px 0",
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              borderRadius: 8,
              color: "#fbbf24",
              fontWeight: 600,
              fontSize: 13,
              cursor: rollbackLoading ? "not-allowed" : "pointer",
              opacity: rollbackLoading ? 0.6 : 1,
              transition: "all 0.2s ease",
            }}
            onClick={handleRollback}
          >
            {rollbackLoading ? "Rolling back…" : "↺ Rollback Execution"}
          </button>
          {/* Inline error for failed rollback */}
          {rollbackError && (
            <div
              id="rollback-error-inline"
              style={{
                marginTop: 8,
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(244,63,94,0.10)",
                border: "1px solid rgba(244,63,94,0.25)",
                color: "#fda4af",
                fontSize: 12,
              }}
            >
              ✗ {rollbackError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    resolution: "approve" | "deny";
    token: string;
  } | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Toast helpers
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // Approvals query (5s polling)
  const { data: actions = [], isLoading } = useQuery<PendingAction[]>({
    queryKey: ["approvals"],
    queryFn: () => fetch("/api/approvals").then((r) => r.json()),
    refetchInterval: 5000,
  });

  // Audit log query (5s polling)
  const { data: auditEntries = [] } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log"],
    queryFn: () => fetch("/api/audit-log").then((r) => r.json()),
    refetchInterval: 5000,
  });

  // Approve / deny mutation
  const resolveMutation = useMutation({
    mutationFn: async ({
      token,
      resolution,
    }: {
      token: string;
      resolution: "approve" | "deny";
    }) => {
      const res = await fetch(`/api/approvals/${token}/${resolution}`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      setConfirmState(null);
    },
    onError: (err: Error) => {
      // Inline error: close modal, show toast for double-approve / non-blocking failures
      setConfirmState(null);
      addToast("error", err.message);
    },
  });

  const selectedAction = actions.find((a) => a.token === selectedToken) ?? null;
  const pendingCount = actions.filter((a) => a.status === "pending").length;

  return (
    <>
      {/* Verify Integrity Modal */}
      {showVerify && <VerifyModal onClose={() => setShowVerify(false)} />}

      {/* Confirm Modal */}
      {confirmState && selectedAction && (
        <ConfirmModal
          action={selectedAction}
          resolution={confirmState.resolution}
          onConfirm={() =>
            resolveMutation.mutate({
              token: confirmState.token,
              resolution: confirmState.resolution,
            })
          }
          onCancel={() => setConfirmState(null)}
          loading={resolveMutation.isPending}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Layout */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          background: "var(--bg-primary)",
        }}
      >
        {/* Top Header */}
        <header
          style={{
            borderBottom: "1px solid var(--border-subtle)",
            padding: "0 32px",
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 20, 32, 0.9)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
              }}
            >
              🛡
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>
                Warden
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Data Rights Ops Console
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {pendingCount > 0 && (
              <div
                style={{
                  background: "rgba(245, 158, 11, 0.15)",
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  borderRadius: 99,
                  padding: "4px 12px",
                  fontSize: 12,
                  color: "#f59e0b",
                  fontWeight: 600,
                }}
              >
                {pendingCount} pending review{pendingCount !== 1 ? "s" : ""}
              </div>
            )}

            {/* Verify Integrity button */}
            <button
              id="verify-integrity-btn"
              className="btn-verify"
              onClick={() => setShowVerify(true)}
            >
              🔐 Verify Integrity
            </button>

            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
              }}
              title="Connected"
            />
          </div>
        </header>

        {/* Body — split panel */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left — request list */}
          <div
            style={{
              width: 420,
              minWidth: 320,
              borderRight: "1px solid var(--border-subtle)",
              overflowY: "auto",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <h1
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  margin: 0,
                }}
              >
                Requests
              </h1>
            </div>

            {isLoading && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  textAlign: "center",
                  paddingTop: 40,
                }}
              >
                Loading…
              </div>
            )}

            {!isLoading && actions.length === 0 && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: 14,
                  textAlign: "center",
                  paddingTop: 40,
                }}
              >
                No requests yet.
                <br />
                <span style={{ fontSize: 12 }}>
                  Run scan_subject → request_execution via MCP to create one.
                </span>
              </div>
            )}

            {actions.map((action) => (
              <div
                key={action.token}
                className="glass-card"
                onClick={() => setSelectedToken(action.token)}
                style={{
                  padding: "14px 16px",
                  cursor: "pointer",
                  border:
                    selectedToken === action.token
                      ? "1px solid rgba(99, 102, 241, 0.5)"
                      : undefined,
                  background:
                    selectedToken === action.token
                      ? "rgba(99, 102, 241, 0.08)"
                      : undefined,
                  transition: "all 0.15s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <StatusBadge status={action.status} />
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    {action.token.slice(0, 8)}…
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 4,
                    textTransform: "capitalize",
                  }}
                >
                  {action.action === "delete" ? "🗑" : "🔒"} {action.action} request
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    fontFamily: "JetBrains Mono, monospace",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Scan: {action.scanId}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {new Date(action.requestedAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          {/* Right — detail panel */}
          <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
            {selectedAction ? (
              <DetailPanel
                action={selectedAction}
                onApprove={(token) => setConfirmState({ resolution: "approve", token })}
                onDeny={(token) => setConfirmState({ resolution: "deny", token })}
                onRollbackError={(msg) => addToast("error", msg)}
              />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-muted)",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 48 }}>🛡</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Warden Ops Console</div>
                <div
                  style={{
                    fontSize: 13,
                    textAlign: "center",
                    maxWidth: 300,
                    lineHeight: 1.6,
                  }}
                >
                  Select a request on the left to review its details and take action.
                </div>
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                  }}
                >
                  Every action is cryptographically audited
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Audit Log Feed — bottom bar */}
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "14px 32px 18px",
            background: "rgba(10, 13, 20, 0.7)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Audit Log
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              Last {auditEntries.length} entries · live
            </div>
          </div>
          <AuditFeed entries={auditEntries} />
        </div>
      </div>
    </>
  );
}
