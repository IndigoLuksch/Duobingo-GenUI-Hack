"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import course from "../../data/courses/de.json";
import PathMap from "@/components/PathMap";
import MemoryPlaceSearch from "@/components/MemoryPlaceSearch";
import { Course, LearnerProfile } from "@/lib/types";

const typedCourse = course as Course;

const defaultProfile: LearnerProfile = {
  uid: "demo",
  xp: 0,
  streak: 0,
  hearts: 3,
  last_active: new Date().toISOString(),
  unit_progress: {
    kitchen_1: "current",
    cafe_1: "locked",
  },
};

interface SelectedUnit {
  unitId: string;
  title: string;
}

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<SelectedUnit | null>(null);
  const [navigatingToLesson, setNavigatingToLesson] = useState(false);

  useEffect(() => {
    fetch("/api/redis/profile?uid=demo")
      .then((res) => res.json())
      .then((data: LearnerProfile) => setProfile(data))
      .catch(() => setProfile(defaultProfile));
  }, []);

  useEffect(() => {
    if (!selectedUnit) return;
    router.prefetch(`/lesson/${selectedUnit.unitId}`);
  }, [selectedUnit, router]);

  const handleUnitClick = (unitId: string) => {
    const unit = typedCourse.units.find((u) => u.unit_id === unitId);
    if (unit) {
      setSelectedUnit({ unitId, title: unit.title });
    }
  };

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

  if (!profile) {
    return null;
  }

  return (
    <>
      <PathMap
        units={typedCourse.units}
        progress={profile.unit_progress}
        xp={profile.xp}
        streak={profile.streak}
        onUnitClick={handleUnitClick}
      />
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
