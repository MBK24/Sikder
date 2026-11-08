/** Official per-section structure of the MCAT. Used by section-test mode and Getting Started copy. */
export const MCAT_SECTIONS = {
  cp: { questions: 59, minutes: 95, label: "Chemical and Physical Foundations of Biological Systems" },
  cars: { questions: 53, minutes: 90, label: "Critical Analysis and Reasoning Skills" },
  bb: { questions: 59, minutes: 95, label: "Biological and Biochemical Foundations of Living Systems" },
  ps: { questions: 59, minutes: 95, label: "Psychological, Social, and Biological Foundations of Behavior" },
} as const;

export const SECTION_SCORE = { min: 118, max: 132, mid: 125 } as const;
export const TOTAL_SCORE = { min: 472, max: 528, mid: 500 } as const;
