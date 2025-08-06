// types.ts - Type definitions for browser proxy service
import { z } from "zod";
import type { chromium } from "playwright";

// Define base schema with common properties
export const baseCommandSchema = z.object({
  timeout: z.number().positive().optional(),
});

// Command-specific schemas
export const gotoCommandSchema = baseCommandSchema.extend({
  action: z.literal("goto"),
  url: z.string().url(),
  params: z.record(z.unknown()).optional(),
});

export const clickCommandSchema = baseCommandSchema.extend({
  action: z.literal("click"),
  selector: z.string().min(1),
  frame: z.string().optional(),
  params: z.record(z.unknown()).optional(),
});

export const fillCommandSchema = baseCommandSchema.extend({
  action: z.literal("fill"),
  selector: z.string().min(1),
  frame: z.string().optional(),
  text: z.string(),
  params: z.record(z.unknown()).optional(),
});

export const screenshotCommandSchema = baseCommandSchema.extend({
  action: z.literal("screenshot"),
  params: z.record(z.unknown()).optional(),
});

export const contentCommandSchema = baseCommandSchema.extend({
  action: z.literal("content"),
  frame: z.string().optional(),
});

export const titleCommandSchema = baseCommandSchema.extend({
  action: z.literal("title"),
});

export const evaluateCommandSchema = baseCommandSchema.extend({
  action: z.literal("evaluate"),
  frame: z.string().optional(),
  params: z.object({
    expression: z.string().min(1),
  }).passthrough(),
});

export const closePageCommandSchema = baseCommandSchema.extend({
  action: z.literal("closePage"),
});

// Combine all command schemas into a discriminated union
export const browserCommandSchema = z.discriminatedUnion("action", [
  gotoCommandSchema,
  clickCommandSchema,
  fillCommandSchema,
  screenshotCommandSchema,
  contentCommandSchema,
  titleCommandSchema,
  evaluateCommandSchema,
  closePageCommandSchema,
]);

// Infer the TypeScript type from the Zod schema
export type BrowserCommand = z.infer<typeof browserCommandSchema>;

// Define types for browser context and pages
export type BrowserContextType = Awaited<
  ReturnType<typeof chromium.launchPersistentContext>
>;
export type PageType = Awaited<ReturnType<BrowserContextType["newPage"]>>;
