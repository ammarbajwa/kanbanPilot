"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useMergeStamp } from "./mergestamp-provider";

const navigation = [
  { href: "/", label: "Board" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export function MergeStampShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const {
    project,
    demoHealth,
    workerMessage,
    validationMessages,
    clearValidationMessages,
  } = useMergeStamp();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <Link href="/" className="brand-name">
            MergeStamp
          </Link>
          <span className="project-name">{project.name}</span>
        </div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigation.map((item) => {
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                href={item.href}
                className={active ? "active" : undefined}
                aria-current={active ? "page" : undefined}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="header-status">
          <span
            className={`status-dot ${demoHealth?.status === "ready" ? "ready" : "blocked"}`}
            aria-hidden="true"
          />
          <span>{workerMessage}</span>
          <a href={project.repository.url} target="_blank" rel="noreferrer">
            {project.repository.owner}/{project.repository.name}
          </a>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions ? <div className="page-actions">{actions}</div> : null}
      </section>

      {validationMessages.length > 0 ? (
        <section className="notice" aria-live="polite">
          <div>
            <strong>Action needed</strong>
            <ul>
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Dismiss message"
            title="Dismiss"
            onClick={clearValidationMessages}
          >
            ×
          </button>
        </section>
      ) : null}

      {children}
    </main>
  );
}
