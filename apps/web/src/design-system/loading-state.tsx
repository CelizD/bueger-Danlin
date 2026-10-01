import styles from "./components.module.css";

export type LoadingStateProps = {
  label?: string;
};

export function LoadingState({
  label = "Cargando…",
}: LoadingStateProps) {
  return (
    <div
      className={styles.loadingRow}
      role="status"
      aria-live="polite"
    >
      <span
        className={styles.spinner}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  );
}
