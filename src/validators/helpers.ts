import { z } from "zod";

export const stringOrUndefined = z
  .string()
  .refine((val) => (val.length > 0 ? val : undefined))
  .optional();

export const numberOrUndefined = z
  .number()
  .refine((val) => (val === undefined ? undefined : val))
  .optional();

export const numberArrayOrUndefined = z
  .array(z.number())
  .refine((val) => (val.length > 0 ? val : undefined))
  .optional();

export const stringArrayOrUndefined = z
  .array(z.string())
  .refine((val) => (val.length > 0 ? val : undefined))
  .optional();

export const booleanOrUndefined = z
  .boolean()
  .refine((val) => (val === undefined ? undefined : val))
  .optional();
