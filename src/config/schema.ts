import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.string(),
  site: z.object({
    url: z.string().url(),
    sitemap: z.string().url(),
  }),
  keywords: z.array(z.string()).default([]),
  apis: z.object({
    indexnow: z.object({
      key: z.string(),
    }).optional(),
    google: z.object({
      serviceAccountPath: z.string(),
      siteUrl: z.string(),
    }).optional(),
    bing: z.object({
      apiKey: z.string(),
      siteUrl: z.string(),
    }).optional(),
    customSearch: z.object({
      apiKey: z.string(),
      engineId: z.string(),
    }).optional(),
  }).default({}),
  discover: z.object({
    sites: z.array(z.string()).default(['reddit.com', 'quora.com']),
    resultsPerKeyword: z.number().int().positive().default(5),
    directoryQueries: z.array(z.string()).optional(),
  }).default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
