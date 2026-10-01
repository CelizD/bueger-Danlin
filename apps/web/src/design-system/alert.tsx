import type { HTMLAttributes } from "react";
import styles from "./components.module.css";

export type AlertTone =
  | "info"
  | "success"
  | "warning"
  | "danger";

export type AlertProps = HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
};

const TONE_CLASS: Record<AlertTone, string> = {
  info: styles.alertInfo!,
  success: styles.alertSuccess!,
  warning: styles.alertWarning!,
  danger: styles.alertDanger!,
};

export function Alert({
  tone = "info",
  className,
  role,
  ...props
}: AlertProps) {
  return (
    <div
      {...props}
      className={[
        styles.alert,
        TONE_CLASS[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role={role ?? (tone === "danger" ? "alert" : "status")}
    />
  );
}
