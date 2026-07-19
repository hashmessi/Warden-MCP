"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { PendingAction } from "./types";

// --- Status Badge ---
function StatusBadge({ status }: { status: PendingAction["status"] }) {
  const classes = {
    pending: "badge badge-pending",
    approved: "badge badge-approved",
    denied: "badge badge-denied",
  }[status];

  const dot = status === "pending" ? "pulse-dot" : "";

  return (
    <span className={classes}>
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

// --- Risk Badge ---
function RiskBadge({ risk }: { risk: string }) {
  const colorClass = {
    CRITICAL: "risk-critical",
    HIGH: "risk-high",
    MEDIUM: "risk-medium",
    LOW: "risk-low",
  }[risk] ?? "risk-low";

  return (
    <span
      className={colorClass}
      style={{ fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}
    >
      {risk}
    </span>
  );
}

// --- Confirmation Modal ---
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
          <div style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-primary)", fontSize: 12 }}>
            {action.scanId}
          </div>
          <div style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 4 }}>Action</div>
          <div style={{ color: "var(--text-primary)", textTransform: "capitalize" }}>{action.action}</div>
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

// --- Detail Panel ---
function DetailPanel({
  action,
  onApprove,
  onDeny,
}: {
  action: PendingAction;
  onApprove: (token: string) => void;
  onDeny: (token: string) => void;
}) {
  const isPending = action.status === "pending";
  return (
    <div className="animate-fadein" style={{ height: "100%", overflowY: "auto", padding: "0 0 40px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Scan ID
        </div>
        <code style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "#93c5fd" }}>
          {action.scanId}
        </code>
      </div>

      {/* Action */}
      <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Requested Action
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, textTransform: "capitalize" }}>
          {action.action === "delete" ? "🗑 Delete all records" : "🔒 Anonymize all records"}
        </div>
      </div>

      {/* Resolution */}
      {action.resolvedAt && (
        <div className="glass-card" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
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
            className="btn-approve"
            style={{ flex: 1, padding: "12px 0" }}
            onClick={() => onApprove(action.token)}
          >
            ✓ Approve
          </button>
          <button
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
          <strong style={{ color: action.status === "approved" ? "#10b981" : "#f43f5e" }}>
            {action.status}
          </strong>
          . A new scan must be run to re-submit.
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ resolution: "approve" | "deny"; token: string } | null>(null);

  const { data: actions = [], isLoading } = useQuery<PendingAction[]>({
    queryKey: ["approvals"],
    queryFn: () => fetch("/api/approvals").then((r) => r.json()),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ token, resolution }: { token: string; resolution: "approve" | "deny" }) => {
      const res = await fetch(`/api/approvals/${token}/${resolution}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Request failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      setConfirm(null);
    },
  });

  const selectedAction = actions.find((a) => a.token === selectedToken) ?? null;
  const pendingCount = actions.filter((a) => a.status === "pending").length;

  return (
    <>
      {/* Confirm Modal */}
      {confirm && selectedAction && (
        <ConfirmModal
          action={selectedAction}
          resolution={confirm.resolution}
          onConfirm={() => resolveMutation.mutate({ token: confirm.token, resolution: confirm.resolution })}
          onCancel={() => setConfirm(null)}
          loading={resolveMutation.isPending}
        />
      )}

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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
              <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
                Loading…
              </div>
            )}

            {!isLoading && actions.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
                No requests yet.
                <br />
                <span style={{ fontSize: 12 }}>Run scan_subject → request_execution via MCP to create one.</span>
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
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, textTransform: "capitalize" }}>
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
                onApprove={(token) => setConfirm({ resolution: "approve", token })}
                onDeny={(token) => setConfirm({ resolution: "deny", token })}
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
                <div style={{ fontSize: 13, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
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
      </div>
    </>
  );
}
