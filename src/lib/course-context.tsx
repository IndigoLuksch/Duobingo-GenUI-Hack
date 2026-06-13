"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CourseId,
  getCourse,
  readStoredCourseId,
  writeStoredCourseId,
} from "./courses";
import { Course } from "./types";

interface CourseContextValue {
  courseId: CourseId;
  course: Course;
  setCourseId: (courseId: CourseId) => void;
  ready: boolean;
}

const CourseContext = createContext<CourseContextValue | null>(null);

export function CourseProvider({ children }: { children: React.ReactNode }) {
  const [courseId, setCourseIdState] = useState<CourseId>("fr");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCourseIdState(readStoredCourseId());
    setReady(true);
  }, []);

  const setCourseId = useCallback((next: CourseId) => {
    setCourseIdState(next);
    writeStoredCourseId(next);
  }, []);

  const value = useMemo(
    () => ({
      courseId,
      course: getCourse(courseId),
      setCourseId,
      ready,
    }),
    [courseId, setCourseId, ready]
  );

  return (
    <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
  );
}

export function useCourse(): CourseContextValue {
  const ctx = useContext(CourseContext);
  if (!ctx) {
    throw new Error("useCourse must be used within CourseProvider");
  }
  return ctx;
}
