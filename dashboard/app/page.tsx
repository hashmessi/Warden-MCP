"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useCallback, useEffect, useRef } from "react";

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

interface ScanHit {
  sourceSystem: string;
  table: string;
  rowCount: number;
  fields?: { fieldName: string; sensitivityTag: string }[];
  hasOrphanRisk?: boolean;
  orphanDetails?: string;
}

interface DependencyItem {
  system: string;
  table: string;
  rowCount: number;
  description: string;
}

interface ImpactReport {
  reportId: string;
  scanId: string;
  subject: string;
  sections: {
    dataFound: { systems: string[]; tables: { system: string; table: string; rowCount: number; sensitivityTags: string[] }[]; totalRecords: number };
    dependencies: { hasRisks: boolean; items: DependencyItem[] };
    riskLevel: string;
    recommendedAction: string;
  };
}

interface ScanResult {
  scanId: string;
  identifier: string;
  totalRecords: number;
  systemsScanned: string[];
  hits: ScanHit[];
  impactReport: ImpactReport;
}

interface ExecuteResult {
  executionId: string;
  token: string;
  snapshotCount: number;
  mode: string;
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

type DemoStep = "idle" | "scanning" | "scan-done" | "approving" | "executing" | "executed" | "rolling-back" | "rolled-back" | "verifying";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_ICONS: Record<string, string> = {
  postgres: "🐘",
  mongodb: "🍃",
  payment_ledger: "💳",
};

const SYSTEM_LABELS: Record<string, string> = {
  postgres: "PostgreSQL",
  mongodb: "MongoDB",
  payment_ledger: "Payment Ledger",
};

const SENSITIVITY_COLORS: Record<string, string> = {
  pii: "#C7A669",
  financial: "#B4797C",
  behavioral: "#7E93A8",
  system: "#55565B",
};

const ACTION_COLORS: Record<string, string> = {
  SCAN: "#7E93A8",
  APPROVAL_REQUESTED: "#C7A669",
  APPROVED: "#93AD97",
  DENIED: "#B4797C",
  EXECUTION_STARTED: "#7E93A8",
  SNAPSHOT_TAKEN: "#8D8E93",
  EXECUTION_COMPLETED: "#93AD97",
  EXECUTION_FAILED: "#B4797C",
  ROLLBACK_STARTED: "#C7A669",
  ROLLBACK_COMPLETED: "#C7A669",
};

// ---------------------------------------------------------------------------
// Verify Modal
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
        let i = 0;
        const step = Math.max(1, Math.floor(json.total / 20));
        const timer = setInterval(() => {
          i = Math.min(i + step, json.total);
          setCount(i);
          if (i >= json.total) {
            clearInterval(timer);
            if (!cancelled) { setData(json); setPhase("done"); }
          }
        }, 60);
      } catch {
        if (!cancelled) setPhase("done");
      }
    }
    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content animate-fadein">
        <div className="modal-header">
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 300, fontFamily: "var(--font-display)" }}>🔐 Audit Chain Verification</h3>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>Walking SHA-256 hash chain entry by entry</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close verification modal">×</button>
        </div>
        {phase === "counting" && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div className="verify-counting" style={{ fontSize: 36, fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--accent-ivory)" }}>
              {count}/{total > 0 ? total : "…"} entries checked
            </div>
            <div style={{ marginTop: 14, color: "var(--text-secondary)", fontSize: 13 }}>Verifying hash chain integrity…</div>
          </div>
        )}
        {phase === "done" && data && (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div className={data.chainIntact ? "verify-banner-pass" : "verify-banner-fail"}>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                {data.chainIntact ? "✓ Chain Intact" : "✗ Tampering Detected"}
              </div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{data.total} entries verified · {data.passed} passed · {data.failed} failed</div>
              {!data.chainIntact && <div style={{ marginTop: 8, fontSize: 12, color: "#f87171" }}>⚠ One or more entries have been tampered. All subsequent entries are untrusted.</div>}
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginBottom: 12, textAlign: "left" }} onClick={() => setExpanded((e) => !e)}>
              {expanded ? "▲ Hide entries" : "▼ Show all entries"} ({data.total})
            </button>
            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {data.results.map((r) => (
                  <div key={r.id} className="audit-feed-entry" style={{ background: r.status === "fail" ? "rgba(244,63,94,0.08)" : "transparent", border: r.status === "fail" ? "1px solid rgba(244,63,94,0.25)" : "1px solid transparent", borderRadius: 6 }}>
                    <span className={`verify-entry-${r.status}`}>{r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "?"}</span>
                    <span style={{ color: "var(--text-muted)", minWidth: 36, fontSize: 11 }}>#{r.id}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", minWidth: 160, fontSize: 11 }}>{r.action}</span>
                    <span style={{ fontFamily: "JetBrains Mono, monospace", color: "var(--text-muted)", fontSize: 10, flex: 1 }}>{r.hashSnippet}…</span>
                    {r.status === "fail" && r.computedHash && <span style={{ fontSize: 10, color: "#f43f5e" }}>expected: {r.computedHash}…</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {phase === "done" && !data && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#f43f5e" }}>Verification failed. Check dashboard logs.</div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// System Card
// ---------------------------------------------------------------------------

function SystemCard({ system, hits, animDelay }: { system: string; hits: ScanHit[]; animDelay: number }) {
  const totalRows = hits.reduce((s, h) => s + h.rowCount, 0);
  const allTags = [...new Set(hits.flatMap(h => h.fields?.map(f => f.sensitivityTag) || []))];
  const hasRisk = hits.some(h => h.hasOrphanRisk);

  return (
    <div className="system-card animate-slidein" style={{ animationDelay: `${animDelay}ms` }}>
      <div className="system-card-header">
        <span className="system-icon">{SYSTEM_ICONS[system] || "💾"}</span>
        <span className="system-name">{SYSTEM_LABELS[system] || system}</span>
        {hasRisk && <span className="risk-tag">⚠ ORPHAN RISK</span>}
      </div>
      <div className="system-card-body">
        {hits.map((h, i) => (
          <div key={i} className="table-hit">
            <div className="table-hit-name">
              <span className="table-icon">📋</span>
              <span>{h.table}</span>
              <span className="record-count">{h.rowCount} record{h.rowCount !== 1 ? "s" : ""}</span>
            </div>
            {h.orphanDetails && <div className="orphan-warning">⚠ {h.orphanDetails}</div>}
          </div>
        ))}
      </div>
      <div className="system-card-footer">
        <span className="total-badge">{totalRows} total</span>
        <div className="sensitivity-tags">
          {allTags.map(tag => (
            <span key={tag} className="sens-tag" style={{ color: SENSITIVITY_COLORS[tag] || "#8892a4", borderColor: SENSITIVITY_COLORS[tag] || "#8892a4" }}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Impact Report Panel
// ---------------------------------------------------------------------------

function ImpactPanel({ report }: { report: ImpactReport }) {
  const riskColors: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e" };
  const riskColor = riskColors[report.sections.riskLevel] || "#22c55e";

  return (
    <div className="impact-panel animate-fadein">
      <div className="impact-header">
        <div className="impact-title">
          <span>📊</span>
          <span>Blast Radius Analysis</span>
        </div>
        <span className="impact-risk-badge" style={{ color: riskColor, borderColor: riskColor }}>
          {report.sections.riskLevel}
        </span>
      </div>
      <div className="impact-summary">
        <strong style={{ color: "var(--accent-ivory)" }}>{report.sections.dataFound.totalRecords}</strong> records found across{" "}
        <strong>{report.sections.dataFound.systems.length}</strong> systems
      </div>
      {report.sections.dependencies.hasRisks && (
        <div className="impact-risks">
          <div className="impact-risks-title">⚠️ Downstream Risks</div>
          <ul>
            {report.sections.dependencies.items.map((item, i) => (
              <li key={i}>{item.description}</li>
            ))}
          </ul>
        </div>
      )}
      {!report.sections.dependencies.hasRisks && (
        <div className="impact-safe">✓ No downstream dependencies found. Safe to proceed.</div>
      )}
      <div className="impact-recommendation">{report.sections.recommendedAction}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Execution Timeline
// ---------------------------------------------------------------------------

function ExecutionTimeline({ steps, isRollback }: { steps: { label: string; status: "pending" | "active" | "done" }[]; isRollback?: boolean }) {
  return (
    <div className="execution-timeline">
      {steps.map((step, i) => (
        <div key={i} className={`timeline-step timeline-step-${step.status}`}>
          <div className="timeline-dot">
            {step.status === "done" ? "✓" : step.status === "active" ? <span className="timeline-spinner" /> : "○"}
          </div>
          <span className="timeline-label">{step.label}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const queryClient = useQueryClient();

  // Demo flow state
  const [step, setStep] = useState<DemoStep>("idle");
  const [commandInput, setCommandInput] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [rescanResult, setRescanResult] = useState<ScanResult | null>(null);
  const [rolledBackScan, setRolledBackScan] = useState<ScanResult | null>(null);
  const [showVerify, setShowVerify] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [execSteps, setExecSteps] = useState<{ label: string; status: "pending" | "active" | "done" }[]>([]);
  const [rollbackSteps, setRollbackSteps] = useState<{ label: string; status: "pending" | "active" | "done" }[]>([]);

  const stepRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Audit log polling
  const { data: auditEntries = [] } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const r = await fetch("/api/audit-log");
      if (!r.ok) throw new Error("audit-log unavailable");
      return r.json();
    },
    refetchInterval: 3000,
    retry: false,
  });

  // Scroll to step
  const scrollToStep = useCallback((key: string) => {
    setTimeout(() => {
      stepRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  // Parse command
  function parseCommand(cmd: string): string | null {
    const match = cmd.match(/(?:purge|delete|erase|remove|scan|find)\s+(?:user\s+)?(.+)/i);
    if (match) return match[1].trim().replace(/['"]/g, "");
    // Fall back to just extracting an email
    const emailMatch = cmd.match(/[\w.-]+@[\w.-]+/i);
    if (emailMatch) return emailMatch[0];
    return null;
  }

  // Handle submit
  async function handleSubmit() {
    const ident = parseCommand(commandInput);
    if (!ident) {
      setError("Try: \"Purge user jane.doe@email.com\" or just enter an email address.");
      return;
    }
    setError(null);
    setIdentifier(ident);
    setStep("scanning");
    setScanResult(null);
    setExecuteResult(null);
    setRescanResult(null);
    setRolledBackScan(null);
    scrollToStep("scan");

    try {
      const res = await fetch("/api/demo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: ident }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setScanResult(data);
      setStep("scan-done");
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      scrollToStep("impact");
    } catch (err: any) {
      setError(err.message);
      setStep("idle");
    }
  }

  // Handle approve & execute
  async function handleApproveAndExecute() {
    if (!scanResult) return;
    setStep("approving");
    scrollToStep("execute");

    // Simulate approval animation
    setExecSteps([
      { label: "Compliance officer reviewing...", status: "active" },
      { label: "Creating pre-execution snapshots", status: "pending" },
      { label: "Deleting records across 3 systems", status: "pending" },
      { label: "Verifying deletion", status: "pending" },
    ]);

    await new Promise(r => setTimeout(r, 800));
    setStep("executing");
    setExecSteps(prev => [
      { ...prev[0], label: "✓ Approved by compliance-officer", status: "done" },
      { ...prev[1], status: "active" },
      prev[2],
      prev[3],
    ]);

    try {
      await new Promise(r => setTimeout(r, 400));
      const res = await fetch("/api/demo/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scanId: scanResult.scanId,
          identifier,
          actionType: "delete",
          impactReport: JSON.stringify(scanResult.impactReport),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExecuteResult(data);

      setExecSteps([
        { label: "✓ Approved by compliance-officer", status: "done" },
        { label: `✓ Snapshot created (${data.snapshotCount} records saved)`, status: "done" },
        { label: "✓ Records deleted across 3 systems", status: "done" },
        { label: "Verifying deletion...", status: "active" },
      ]);

      // Verification scan
      await new Promise(r => setTimeout(r, 500));
      const verifRes = await fetch("/api/demo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const verifData = await verifRes.json();
      setRescanResult(verifData);

      setExecSteps([
        { label: "✓ Approved by compliance-officer", status: "done" },
        { label: `✓ Snapshot created (${data.snapshotCount} records saved)`, status: "done" },
        { label: "✓ Records deleted across 3 systems", status: "done" },
        { label: `✓ Verified: ${verifData.totalRecords} records remaining`, status: "done" },
      ]);

      setStep("executed");
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      scrollToStep("rollback");
    } catch (err: any) {
      setError(err.message);
      setStep("scan-done");
    }
  }

  // Handle rollback
  async function handleRollback() {
    if (!executeResult) return;
    setStep("rolling-back");
    scrollToStep("rollback-progress");

    setRollbackSteps([
      { label: "Restoring PostgreSQL records from snapshot", status: "active" },
      { label: "Restoring MongoDB documents", status: "pending" },
      { label: "Restoring payment ledger entries", status: "pending" },
      { label: "Verifying restoration", status: "pending" },
    ]);

    try {
      await new Promise(r => setTimeout(r, 600));
      const res = await fetch("/api/demo/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId: executeResult.executionId,
          identifier,
          token: executeResult.token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRollbackSteps([
        { label: "✓ PostgreSQL records restored", status: "done" },
        { label: "✓ MongoDB documents restored", status: "done" },
        { label: "✓ Payment ledger entries restored", status: "done" },
        { label: "Verifying restoration...", status: "active" },
      ]);

      // Post-rollback verification scan
      await new Promise(r => setTimeout(r, 500));
      const scanRes = await fetch("/api/demo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const scanData = await scanRes.json();
      setRolledBackScan(scanData);

      setRollbackSteps([
        { label: "✓ PostgreSQL records restored", status: "done" },
        { label: "✓ MongoDB documents restored", status: "done" },
        { label: "✓ Payment ledger entries restored", status: "done" },
        { label: `✓ Verified: ${scanData.totalRecords} records back across ${scanData.systemsScanned?.length || 0} systems`, status: "done" },
      ]);

      setStep("rolled-back");
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
      scrollToStep("complete");
    } catch (err: any) {
      setError(err.message);
      setStep("executed");
    }
  }

  // Reset demo
  function resetDemo() {
    setStep("idle");
    setCommandInput("");
    setIdentifier("");
    setScanResult(null);
    setExecuteResult(null);
    setRescanResult(null);
    setRolledBackScan(null);
    setExecSteps([]);
    setRollbackSteps([]);
    setError(null);
  }

  return (
    <>
      {showVerify && <VerifyModal onClose={() => setShowVerify(false)} />}

      <div className="app-layout">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <div className="header-logo">🛡</div>
            <div>
              <div className="header-title">Warden</div>
              <div className="header-subtitle">Data Rights Ops Console</div>
            </div>
          </div>
          <div className="header-right">
            <button className="btn-verify" onClick={() => setShowVerify(true)}>🔐 Verify Integrity</button>
            <div className="status-dot" title="Connected" />
          </div>
        </header>

        {/* Main Content */}
        <div className="main-content">
          <div className="demo-flow">
            {/* Command Input */}
            <div className="command-section">
              <div className="command-label">DATA RIGHTS REQUEST</div>
              <div className="command-box">
                <div className="command-prompt">$</div>
                <input
                  id="command-input"
                  className="command-input"
                  type="text"
                  placeholder='Purge user jane.doe@email.com'
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && step === "idle") handleSubmit(); }}
                  disabled={step !== "idle"}
                  autoFocus
                />
                <button
                  id="scan-btn"
                  className="command-go"
                  onClick={handleSubmit}
                  disabled={step !== "idle" || !commandInput.trim()}
                >
                  {step === "idle" ? "⚡ Execute" : "Running…"}
                </button>
              </div>
              {error && <div className="command-error">✗ {error}</div>}
              {step !== "idle" && (
                <button className="btn-reset" onClick={resetDemo}>↺ New Request</button>
              )}
            </div>

            {/* Step 1: Scan Results */}
            {(step !== "idle") && (
              <div ref={el => { stepRefs.current["scan"] = el; }} className="flow-step">
                <div className="step-header">
                  <div className={`step-number${step === "scanning" ? " step-number-active" : ""}`}>1</div>
                  <div className="step-title">DISCOVERY — Multi-System Scan</div>
                  {step === "scanning" && <span className="step-badge-loading">Scanning…</span>}
                  {step !== "scanning" && scanResult && <span className="step-badge-done">✓ Complete</span>}
                </div>
                {step === "scanning" && (
                  <div className="scan-loading">
                    <div className="scan-spinner" />
                    <span>Querying PostgreSQL, MongoDB, and Payment Ledger…</span>
                  </div>
                )}
                {scanResult && (
                  <div className="scan-results">
                    <div className="scan-summary">
                      Found <strong className="highlight-number">{scanResult.totalRecords}</strong> records across{" "}
                      <strong className="highlight-number">{scanResult.systemsScanned.length}</strong> systems for{" "}
                      <code className="highlight-identifier">{scanResult.identifier}</code>
                    </div>
                    <div className="system-cards">
                      {scanResult.systemsScanned.map((sys, i) => (
                        <SystemCard
                          key={sys}
                          system={sys}
                          hits={scanResult.hits.filter(h => h.sourceSystem === sys)}
                          animDelay={i * 200}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Impact Report */}
            {scanResult && step !== "scanning" && (
              <div ref={el => { stepRefs.current["impact"] = el; }} className="flow-step animate-fadein">
                <div className="step-header">
                  <div className="step-number">2</div>
                  <div className="step-title">BLAST RADIUS — Impact Analysis</div>
                </div>
                <ImpactPanel report={scanResult.impactReport} />
              </div>
            )}

            {/* Step 3: Approval Gate */}
            {step === "scan-done" && scanResult && (
              <div ref={el => { stepRefs.current["approve"] = el; }} className="flow-step animate-fadein">
                <div className="step-header">
                  <div className="step-number">3</div>
                  <div className="step-title">APPROVAL GATE — Review & Authorize</div>
                </div>
                <div className="approval-gate">
                  <div className="approval-persona">
                    <div className="persona-avatar">👤</div>
                    <div>
                      <div className="persona-name">Compliance Officer</div>
                      <div className="persona-role">Authorized to approve data deletion requests</div>
                    </div>
                  </div>
                  <div className="approval-warning">
                    ⚠ This will permanently delete <strong>{scanResult.totalRecords} records</strong> across{" "}
                    {scanResult.systemsScanned.length} systems. A pre-execution snapshot will be created for rollback.
                  </div>
                  <div className="approval-actions">
                    <button id="approve-execute-btn" className="btn-approve-large" onClick={handleApproveAndExecute}>
                      ✓ Approve & Execute Deletion
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Execution */}
            {(step === "approving" || step === "executing" || step === "executed" || step === "rolling-back" || step === "rolled-back") && (
              <div ref={el => { stepRefs.current["execute"] = el; }} className="flow-step animate-fadein">
                <div className="step-header">
                  <div className={`step-number${(step === "approving" || step === "executing") ? " step-number-active" : ""}`}>4</div>
                  <div className="step-title">EXECUTION — Snapshot, Delete, Verify</div>
                  {step === "executed" || step === "rolling-back" || step === "rolled-back" ? <span className="step-badge-done">✓ Complete</span> : <span className="step-badge-loading">In progress…</span>}
                </div>
                <ExecutionTimeline steps={execSteps} />
                {rescanResult && (
                  <div className="verification-result">
                    <span className="verification-icon">{rescanResult.totalRecords === 0 ? "🟢" : "🔴"}</span>
                    <span>Post-deletion scan: <strong>{rescanResult.totalRecords}</strong> records remaining</span>
                    {rescanResult.totalRecords === 0 && <span className="verification-ok"> — all data purged</span>}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Rollback — THE MOMENT */}
            {step === "executed" && (
              <div ref={el => { stepRefs.current["rollback"] = el; }} className="flow-step animate-fadein rollback-section">
                <div className="step-header">
                  <div className="step-number rollback-number">5</div>
                  <div className="step-title rollback-title">THE MOMENT — "But what if we made a mistake?"</div>
                </div>
                <div className="rollback-gate">
                  <div className="rollback-narrative">
                    The data is gone from all 3 systems. But Warden took a snapshot <em>before</em> any mutation.
                    Every action is logged in a tamper-evident hash chain. We can undo this.
                  </div>
                  <button id="rollback-btn" className="btn-rollback-large" onClick={handleRollback}>
                    ↺ Rollback — Restore All Data
                  </button>
                </div>
              </div>
            )}

            {/* Rollback Progress */}
            {(step === "rolling-back" || step === "rolled-back") && (
              <div ref={el => { stepRefs.current["rollback-progress"] = el; }} className="flow-step animate-fadein">
                <div className="step-header">
                  <div className={`step-number rollback-number${step === "rolling-back" ? " step-number-active" : ""}`}>5</div>
                  <div className="step-title rollback-title">ROLLBACK — Restoring from Snapshot</div>
                  {step === "rolled-back" ? <span className="step-badge-done">✓ Complete</span> : <span className="step-badge-loading">Restoring…</span>}
                </div>
                <ExecutionTimeline steps={rollbackSteps} isRollback />
              </div>
            )}

            {/* Step 6: Verification Complete */}
            {step === "rolled-back" && (
              <div ref={el => { stepRefs.current["complete"] = el; }} className="flow-step animate-fadein completion-section">
                <div className="step-header">
                  <div className="step-number complete-number">6</div>
                  <div className="step-title">VERIFIED — Full Cycle Complete</div>
                </div>
                <div className="completion-card">
                  <div className="completion-grid">
                    <div className="completion-stat">
                      <div className="stat-value">{rolledBackScan?.totalRecords ?? "—"}</div>
                      <div className="stat-label">Records Restored</div>
                    </div>
                    <div className="completion-stat">
                      <div className="stat-value">{rolledBackScan?.systemsScanned?.length ?? "—"}</div>
                      <div className="stat-label">Systems Verified</div>
                    </div>
                    <div className="completion-stat">
                      <div className="stat-value">✓</div>
                      <div className="stat-label">Hash Chain Intact</div>
                    </div>
                  </div>
                  <div className="completion-message">
                    Every action — scan, approval, execution, deletion, rollback, and restoration — is recorded in a tamper-evident SHA-256 hash chain.
                    Click <strong>Verify Integrity</strong> to walk the chain and prove nothing was altered.
                  </div>
                  <div className="completion-actions">
                    <button className="btn-verify-large" onClick={() => setShowVerify(true)}>🔐 Verify Hash Chain Integrity</button>
                    <button className="btn-reset" onClick={resetDemo}>↺ Run Another Demo</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Audit Log Sidebar */}
          <aside className="audit-sidebar">
            <div className="audit-sidebar-header">
              <div className="audit-sidebar-title">AUDIT LOG</div>
              <div className="audit-sidebar-count">{auditEntries.length} entries</div>
            </div>
            <div className="audit-sidebar-feed">
              {auditEntries.length === 0 && (
                <div className="audit-empty">No entries yet. Run a scan to begin.</div>
              )}
              {auditEntries.map((e) => (
                <div key={e.id} className="audit-entry">
                  <span className="audit-action" style={{ color: ACTION_COLORS[e.action] || "var(--text-secondary)" }}>
                    {e.action}
                  </span>
                  <span className="audit-actor">{e.actor}</span>
                  <span className="audit-hash">{String(e.hash).slice(0, 8)}…</span>
                  <span className="audit-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
