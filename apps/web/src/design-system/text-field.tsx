import type { InputHTMLAttributes } from "react";
import styles from "./components.module.css";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  id,
  label,
  hint,
  error,
  ...props
}: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={styles.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p
          className={styles.errorText}
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
