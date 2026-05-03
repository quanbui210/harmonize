import { z } from "zod";
import { marketCodeSchema } from "@/lib/validation/shared";

const materialSchema = z.object({
  material: z.string().min(2).max(120),
  percentage: z.number().min(0).max(100),
});

const productContentFields = {
  name: z.string().min(3).max(160),
  description: z.string().min(10).max(2000),
  intendedUse: z.string().max(200).optional(),
  targetMarkets: z.array(marketCodeSchema).min(1),
  materials: z.array(materialSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
};

function withMaterialValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((value, ctx) => {
    const materials = (value as { materials: Array<{ percentage: number }> }).materials;
    const total = materials.reduce(
      (sum: number, material: { percentage: number }) => sum + material.percentage,
      0,
    );

    if (total > 100.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["materials"],
        message: "Material percentages cannot exceed 100",
      });
    }
  });
}

export const createProductPayloadSchema = withMaterialValidation(
  z.object(productContentFields),
);

export const createProductSchema = withMaterialValidation(
  z.object({
    organizationId: z.string().cuid(),
    createdById: z.string().cuid(),
    ...productContentFields,
  }),
);

export const updateProductPayloadSchema = withMaterialValidation(
  z.object(productContentFields),
);

export const updateProductSchema = withMaterialValidation(
  z.object({
    organizationId: z.string().cuid(),
    productId: z.string().cuid(),
    ...productContentFields,
  }),
);

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductMaterialInput = z.infer<typeof materialSchema>;

