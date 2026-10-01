import type { ReactNode } from "react";
import styles from "./components.module.css";

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <section className={styles.state}>
      <h2 className={styles.stateTitle}>{title}</h2>
      <p className={styles.stateBody}>{description}</p>
      {action}
    </section>
  );
}
