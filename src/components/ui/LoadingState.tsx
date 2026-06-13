import styles from "./LoadingState.module.css";

interface LoadingStateProps {
  message?: string;
  children?: React.ReactNode;
}

export default function LoadingState({
  message = "Loading…",
  children,
}: LoadingStateProps) {
  return (
    <div className={styles.container}>
      <div className={styles.spinner} aria-hidden />
      <p className={styles.message}>{message}</p>
      {children}
    </div>
  );
}
