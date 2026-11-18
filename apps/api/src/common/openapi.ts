import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { type ZodObject, type ZodType, z } from 'zod';

type JsonSchema = Record<string, unknown> & {
  properties?: Record<string, object>;
  required?: string[];
};

/** OpenAPI comes from the same Zod schemas that validate requests, so docs can't drift. */
function toOpenApi(schema: ZodType, io: 'input' | 'output'): JsonSchema {
  const { $schema: _, ...json } = z.toJSONSchema(schema, {
    target: 'openapi-3.0',
    io,
    unrepresentable: 'any',
  });
  return json as JsonSchema;
}

export const ApiZodBody = (schema: ZodType) => ApiBody({ schema: toOpenApi(schema, 'input') });

export const ApiZodResponse = (status: number, schema: ZodType, description = 'Success') =>
  ApiResponse({ status, description, schema: toOpenApi(schema, 'output') });

export function ApiZodQuery(schema: ZodObject) {
  const { properties = {}, required = [] } = toOpenApi(schema, 'input');
  return applyDecorators(
    ...Object.entries(properties).map(([name, s]) =>
      ApiQuery({ name, required: required.includes(name), schema: s }),
    ),
  );
}

export const errorSchema = z.object({
  statusCode: z.int().optional(),
  message: z.string(),
  error: z.string().optional(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional()
    .describe('400: invalid fields'),
  missing: z.array(z.string()).optional().describe('422: fields required before submitting'),
});

const ERROR_SCHEMA = toOpenApi(errorSchema, 'output');

/** e.g. @ApiErrors([404, 'Not your vehicle or deleted'], [409, 'Stale version']) */
export const ApiErrors = (...errors: [status: number, description: string][]) =>
  applyDecorators(
    ...errors.map(([status, description]) =>
      ApiResponse({ status, description, schema: ERROR_SCHEMA }),
    ),
  );
