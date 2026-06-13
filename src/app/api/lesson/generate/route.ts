import { NextRequest, NextResponse } from "next/server";
import { CourseId, isCourseId } from "@/lib/courses";
import { generateLesson } from "@/lib/lesson-generation";

export async function POST(req: NextRequest) {
  try {
    const { topic, courseId: rawCourseId } = (await req.json()) as {
      topic?: string;
      courseId?: string;
    };

    if (!topic?.trim()) {
      return NextResponse.json(
        { error: "topic is required" },
        { status: 400 }
      );
    }

    const courseId: CourseId =
      rawCourseId && isCourseId(rawCourseId) ? rawCourseId : "fr";

    const unit = await generateLesson(topic, courseId);

    if (!unit) {
      return NextResponse.json(
        { error: "Could not generate lesson. Check API keys and try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({ unit });
  } catch (e) {
    console.error("lesson generate error:", e);
    return NextResponse.json(
      { error: "Lesson generation failed" },
      { status: 500 }
    );
  }
}
