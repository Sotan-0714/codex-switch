import { motion } from "framer-motion";
import { CheckCircle2, Copy, FolderOpen, XCircle } from "lucide-react";
import { type ReactNode } from "react";

// Shared presentational primitives extracted from AppV30 (T-501). These are
// pure prop-driven components with no app-local state, reused across pages.

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) { return <section className="settings-group"><h2>{title}</h2><div>{children}</div></section>; }
export function SettingRow({ label, description, children }: { label: string; description: string; children: ReactNode }) { return <div className="setting-row"><div><strong>{label}</strong><span>{description}</span></div><div>{children}</div></div>; }

export function Card({ title, icon, headerRight, compact = false, children }: { title: string; icon?: ReactNode; headerRight?: ReactNode; compact?: boolean; children: ReactNode }) { return <section className={`card ${compact ? "compact-card" : ""}`}><header className="card-header"><div>{icon && <span className="card-icon">{icon}</span>}<h2>{title}</h2></div>{headerRight}</header><div className="card-content">{children}</div></section>; }
export function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) { return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span>{children}</label>; }
export function Badge({ tone, children }: { tone: "success" | "warning" | "caution" | "error" | "accent"; children: ReactNode }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function CodeLine({ children }: { children: ReactNode }) { return <span className="code-line">{children}</span>; }
export function Metric({ title, value, badge }: { title: string; value: number | string; badge?: string }) { return <div className="metric-card"><div><span>{title}</span>{badge && <Badge tone="warning">{badge}</Badge>}</div><strong>{typeof value === "number" ? value.toLocaleString() : value}</strong></div>; }

export function KeyValueRow({ label, value, copy, open, showToast }: { label: string; value: string; copy?: boolean; open?: boolean; showToast?: (message: string) => void }) {
  return <div className="key-value-row"><span>{label}</span><code>{value || "—"}</code><div className="row-actions">{copy && <button onClick={async () => { await navigator.clipboard.writeText(value); showToast?.(`已复制 ${label}`); }} aria-label={`Copy ${label}`} title={`Copy ${label}`}><Copy /></button>}{open && <button onClick={() => window.api.openPath(value)} aria-label={`Open ${label}`} title={`Open ${label}`}><FolderOpen /></button>}</div></div>;
}

export function Toggle({ checked, onChange, label, ariaLabel }: { checked: boolean; onChange: (value: boolean) => void; label?: string; ariaLabel?: string }) { return <label className="toggle-row">{label && <span>{label}</span>}<button type="button" className={`toggle ${checked ? "on" : ""}`} role="switch" aria-checked={checked} aria-label={ariaLabel || label} onClick={() => onChange(!checked)}><span /></button></label>; }

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) { return <div className="empty-state"><div>{icon}</div><strong>{title}</strong><span>{description}</span>{action}</div>; }

export function Toast({ message, error }: { message: string; error?: boolean }) { return <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`toast ${error ? "error" : ""}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>{error ? <XCircle /> : <CheckCircle2 />}<span>{message}</span></motion.div>; }

export function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) { return <div className="section-heading"><span>{number}</span><div><h2>{title}</h2><p>{description}</p></div></div>; }
