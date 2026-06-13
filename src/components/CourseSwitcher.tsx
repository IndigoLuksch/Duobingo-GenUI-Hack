"use client";

import { COURSE_FLAGS, COURSE_IDS, COURSES } from "@/lib/courses";
import { useCourse } from "@/lib/course-context";
import styles from "./CourseSwitcher.module.css";

export default function CourseSwitcher() {
  const { courseId, setCourseId } = useCourse();

  return (
    <label className={styles.switcher}>
      <select
        className={styles.select}
        value={courseId}
        onChange={(event) => setCourseId(event.target.value as typeof courseId)}
        aria-label="Learning language"
      >
        {COURSE_IDS.map((id) => (
          <option key={id} value={id}>
            {COURSE_FLAGS[id]} {COURSES[id].title}
          </option>
        ))}
      </select>
      <span className={styles.chevron} aria-hidden>
        ▾
      </span>
    </label>
  );
}
