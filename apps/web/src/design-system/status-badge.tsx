import type { HTMLAttributes } from "react";
import styles from "./components.module.css";

export type StatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export type StatusBadgeProps =
  HTMLAttributes<HTMLSpanElement> & {
    tone?: StatusTone;
  };

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: styles.badgeNeutral,
  info: styles.badgeInfo,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
};

export function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      {...props}
      className={[
        styles.badge,
        TONE_CLASS[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
