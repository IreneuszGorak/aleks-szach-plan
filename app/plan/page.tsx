import type { Metadata } from "next";
import PlanFlow from "@/components/PlanFlow";

export const metadata: Metadata = {
  title: "Zaplanuj tydzień — Nakrycie",
};

export default function PlanPage() {
  return <PlanFlow />;
}
