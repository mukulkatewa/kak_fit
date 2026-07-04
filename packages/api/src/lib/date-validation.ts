import { z } from "zod";

const MIN_LOG_DATE = new Date("2000-01-01");
const MAX_LOG_DATE_BUFFER_MS = 24 * 60 * 60 * 1000;

function maxLogDate() {
  return new Date(Date.now() + MAX_LOG_DATE_BUFFER_MS);
}

function validateLogDate(date: Date, ctx: z.RefinementCtx) {
  if (date < MIN_LOG_DATE) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date cannot be before year 2000" });
  }
  if (date > maxLogDate()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date cannot be in the future" });
  }
}

/** Optional ISO datetime string for log entry dates (body measurements, etc.). */
export const optionalIsoDateSchema = z
  .string()
  .datetime()
  .transform((s) => new Date(s))
  .superRefine(validateLogDate)
  .optional();

/** Optional epoch-ms date for nutrition day queries and meal logging. */
export const optionalDateMsSchema = z
  .number()
  .optional()
  .superRefine((ms, ctx) => {
    if (ms == null) return;
    validateLogDate(new Date(ms), ctx);
  });
