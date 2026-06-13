import LoadingState from "@/components/ui/LoadingState";

export default function LessonLoading() {
  return (
    <div className="appShell">
      <LoadingState message="Preparing your lesson…" />
    </div>
  );
}
