import { z } from "zod";
import {
  classificationStatusSchema,
  marketCodeSchema,
  riskTypeSchema,
} from "@/lib/validation/shared";

const reasoningStepSchema = z.object({
  level: z.enum(["CHAPTER", "HEADING", "SUBHEADING", "NOTE"]),
  selection: z.string().min(1),
  rationale: z.string().min(1),
  score: z.number().min(0).max(1).optional(),
});

const sourceSchema = z.object({
  sourceType: z.enum(["LEGAL_NOTE", "BINDING_RULING", "EXPLANATORY_NOTE"]),
  referenceId: z.string().optional(),
  excerpt: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const riskFlagSchema = z.object({
  riskType: riskTypeSchema,
  label: z.string().min(2),
  details: z.string().optional(),
});

export const classificationUpsertSchema = z
  .object({
    classificationId: z.string().cuid().optional(),
    organizationId: z.string().cuid(),
    productId: z.string().cuid(),
    reviewerId: z.string().cuid().optional(),
    market: marketCodeSchema,
    htsCode: z.string().regex(/^\d{4}(\.\d{2}){0,3}$/).optional(),
    status: classificationStatusSchema.default("DRAFT"),
    confidence: z.number().min(0).max(1).optional(),
    summary: z.string().max(2000).optional(),
    reasoningTrail: z.array(reasoningStepSchema).optional(),
    exclusionNotes: z.array(z.string().max(500)).optional(),
    humanNotes: z.string().max(1500).optional(),
    requiresReview: z.boolean().optional(),
    sources: z.array(sourceSchema).default([]),
    riskFlags: z.array(riskFlagSchema).default([]),
  })
  .refine(
    (value) => {
      if (!value.htsCode) {
        return true;
      }
      return value.status !== "DRAFT";
    },
    {
      message: "HTS code can only be stored when status is not draft",
      path: ["status"],
    },
  )
  .refine(
    (value) => {
      if (value.confidence === undefined) {
        return true;
      }
      if (value.confidence < 0.8) {
        return value.requiresReview === true;
      }
      return true;
    },
    {
      message: "Confidence below 0.8 requires a review flag",
      path: ["requiresReview"],
    },
  );

export type ClassificationUpsertInput = z.infer<
  typeof classificationUpsertSchema
>;

