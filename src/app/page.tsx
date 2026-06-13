"use client";

import { useEffect, useState } from "react";
import course from "../../data/courses/fr.json";
import PathMap from "@/components/PathMap";
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

export default function Home() {
  const [profile, setProfile] = useState<LearnerProfile | null>(null);

  useEffect(() => {
    fetch("/api/redis/profile?uid=demo")
      .then((res) => res.json())
      .then((data: LearnerProfile) => setProfile(data))
      .catch(() => setProfile(defaultProfile));
  }, []);

  if (!profile) {
    return null;
  }

  return (
    <PathMap
      units={typedCourse.units}
      progress={profile.unit_progress}
      xp={profile.xp}
      streak={profile.streak}
    />
  );
}
