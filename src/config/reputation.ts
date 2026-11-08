/**
 * Forum reputation: point values and the thresholds that unlock privileges.
 * Verified roles (Tutor, Expert, Moderator, Admin) bypass every threshold.
 */
export const REP_POINTS = {
  POST_UPVOTED: 5,
  REPLY_UPVOTED: 10,
  ANSWER_ACCEPTED: 15,
  ACCEPTED_AN_ANSWER: 2,
} as const;

export const PRIVILEGES = {
  /**
   * Upvoting is open from 0 rep. Posting already requires Premium, which filters spam,
   * and a brand-new community where nobody can vote would never earn anyone reputation.
   */
  upvote: 0,
  report: 15,
  editTags: 200,
  createTags: 500,
  editOthersPosts: 1000,
} as const;
export type Privilege = keyof typeof PRIVILEGES;

/** Rate limits for forum writes (per user). */
export const FORUM_LIMITS = {
  post: { max: 5, windowSec: 60 * 60 }, // 5 new questions per hour
  reply: { max: 20, windowSec: 60 * 60 },
  vote: { max: 60, windowSec: 60 * 10 },
  report: { max: 10, windowSec: 60 * 60 },
  upload: { max: 20, windowSec: 60 * 60 },
  tutoringMessage: { max: 30, windowSec: 60 * 60 },
} as const;
