import styles from "./LoadingStatusSteps.module.css";

export interface LoadingStatusStep {
  id: string;
  label: string;
}

interface LoadingStatusStepsProps {
  steps: LoadingStatusStep[];
  activeStepId: string;
}

export default function LoadingStatusSteps({
  steps,
  activeStepId,
}: LoadingStatusStepsProps) {
  const activeIndex = steps.findIndex((step) => step.id === activeStepId);

  return (
    <ol className={styles.list} aria-label="Loading progress">
      {steps.map((step, index) => {
        const isComplete = activeIndex > index;
        const isActive = step.id === activeStepId;
        const state = isComplete ? "complete" : isActive ? "active" : "pending";

        return (
          <li key={step.id} className={styles.item} data-state={state}>
            <span className={styles.marker} aria-hidden>
              {isComplete ? "✓" : isActive ? "●" : "○"}
            </span>
            <span className={styles.label}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
