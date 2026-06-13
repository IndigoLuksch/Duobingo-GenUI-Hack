"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PathMap from "@/components/PathMap";
import MemoryPlaceSearch from "@/components/MemoryPlaceSearch";
import NewLessonModal from "@/components/NewLessonModal";
import SkipToWorld from "@/components/SkipToWorld";
import LoadingState from "@/components/ui/LoadingState";
import { useCourse } from "@/lib/course-context";
import { getCustomUnits, saveCustomUnit } from "@/lib/custom-units";
import {
  COURSE_FLAGS,
  defaultUnitProgress,
  mergeUnitProgress,
} from "@/lib/courses";
import { LearnerProfile, Unit } from "@/lib/types";

interface SelectedUnit {
  unitId: string;
  title: string;
}

export default function Home() {
  const router = useRouter();
  const { course, courseId, ready: courseReady } = useCourse();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [customUnits, setCustomUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null);
  const [showNewLesson, setShowNewLesson] = useState(false);
  const [navigatingToLesson, setNavigatingToLesson] = useState(false);

  const units = useMemo(
    () => [...course.units, ...customUnits],
    [course.units, customUnits]
  );

  useEffect(() => {
    setCustomUnits(getCustomUnits(courseId));
  }, [courseId]);

  useEffect(() => {
    if (!courseReady) return;

    fetch("/api/redis/profile?uid=demo")
      .then((res) => res.json())
      .then((data: LearnerProfile) => {
        const mergedProgress = mergeUnitProgress(courseId, data);
        for (const unit of customUnits) {
          if (!mergedProgress[unit.unit_id]) {
            mergedProgress[unit.unit_id] = "current";
          }
        }
        const hasCurrent = Object.values(mergedProgress).some(
          (s) => s === "current"
        );
        if (!hasCurrent && units.length > 0) {
          mergedProgress[units[0].unit_id] = "current";
        }
        setProfile({ ...data, unit_progress: mergedProgress });
      })
      .catch(() =>
        setProfile({
          uid: "demo",
          xp: 0,
          streak: 0,
          hearts: 3,
          last_active: new Date().toISOString(),
          unit_progress: defaultUnitProgress(),
        })
      );
  }, [courseId, courseReady, customUnits, units]);

  useEffect(() => {
    if (!selectedUnit) return;
    router.prefetch(`/lesson/${selectedUnit.unitId}`);
  }, [selectedUnit, router]);

  const handleUnitClick = (unitId: string) => {
    const unit = units.find((u) => u.unit_id === unitId);
    if (unit) {
      setSelectedUnit({ unitId, title: unit.title });
    }
  };

  const handleLessonCreated = useCallback(
    (unit: Unit) => {
      saveCustomUnit(courseId, unit);
      setCustomUnits(getCustomUnits(courseId));
      setShowNewLesson(false);
      setProfile((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unit_progress: {
            ...prev.unit_progress,
            [unit.unit_id]: "current",
          },
        };
      });
      setSelectedUnit({ unitId: unit.unit_id, title: unit.title });
    },
    [courseId]
  );

  const handleMemorySkip = () => {
    if (!selectedUnit) return;
    setNavigatingToLesson(true);
    router.push(`/lesson/${selectedUnit.unitId}`);
  };

  const handleMemoryComplete = (placeId: string) => {
    if (!selectedUnit) return;
    setNavigatingToLesson(true);
    localStorage.setItem(
      "pending_memory_place",
      JSON.stringify({ placeId })
    );
    router.push(`/lesson/${selectedUnit.unitId}`);
  };

  if (!profile || !courseReady) {
    return (
      <div className="appShell">
        <LoadingState message="Loading your path…" />
      </div>
    );
  }

  return (
    <>
      <div className="homeWithSkipBar">
        <PathMap
          units={units}
          progress={profile.unit_progress}
          xp={profile.xp}
          streak={profile.streak}
          courseTitle={course.title}
          courseFlag={COURSE_FLAGS[courseId]}
          onUnitClick={handleUnitClick}
          onNewLesson={() => setShowNewLesson(true)}
        />
      </div>
      <SkipToWorld />
      {showNewLesson && (
        <NewLessonModal
          courseId={courseId}
          onClose={() => setShowNewLesson(false)}
          onCreated={handleLessonCreated}
        />
      )}
      {selectedUnit && (
        <MemoryPlaceSearch
          unitId={selectedUnit.unitId}
          unitTitle={selectedUnit.title}
          navigatingToLesson={navigatingToLesson}
          onSkip={handleMemorySkip}
          onComplete={handleMemoryComplete}
        />
      )}
    </>
  );
}
