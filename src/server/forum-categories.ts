import type { Part } from "@/generated/prisma/enums";

/** Default forum category for a chapter's part (used by "Discuss this chapter"). */
export const CATEGORY_FOR_PART: Record<Part, string> = {
  CP: "chem-phys",
  CARS: "cars",
  BB: "bio-biochem",
  PS: "psych-soc",
  GETTING_STARTED: "study-strategy",
  APPENDIX: "study-strategy",
};
