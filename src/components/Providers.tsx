"use client";

import { CourseProvider } from "@/lib/course-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <CourseProvider>{children}</CourseProvider>;
}
