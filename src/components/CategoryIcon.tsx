"use client";

import { Activity, Baby, Bone, Brain, Droplets, Eye, Flower2, Hand, HeartPulse, Shield, Sparkles, Thermometer, ThermometerSnowflake, Utensils, Wind, Zap, Bandage, type LucideIcon } from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  "heart-pulse": HeartPulse, droplets: Droplets, "thermometer-snowflake": ThermometerSnowflake, thermometer: Thermometer,
  utensils: Utensils, "flower-2": Flower2, zap: Zap, sparkles: Sparkles, brain: Brain, wind: Wind, bone: Bone, hand: Hand,
  eye: Eye, activity: Activity, shield: Shield, bandage: Bandage, baby: Baby,
};

export function CategoryIcon({ name, size = 20 }: { name: string; size?: number }) {
  const I = MAP[name] ?? Activity;
  return <I size={size} strokeWidth={1.75} />;
}
