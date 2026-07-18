import type { z } from 'zod';

import type { rainfallDataSchema, rainfallYearSchema } from '../lib/schemas';

export type RainfallYear = z.infer<typeof rainfallYearSchema>;
export type RainfallData = z.infer<typeof rainfallDataSchema>;

/*
PORT STATUS
  source:     resources/js/Pages/Population/types/rainfall-types.ts (8 lines)
  confidence: high
  todos:      0
  notes:      Rainfall series preserve pcode keys, year values, totals, and averages.
*/
