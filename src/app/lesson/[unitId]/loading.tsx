import LessonPrepLoader from "@/components/LessonPrepLoader";

export default function LessonLoading() {
  return (
    <div className="appShell">
      <LessonPrepLoader indeterminate />
    </div>
  );
}
