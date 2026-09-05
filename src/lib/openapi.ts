/** Builds an OpenAPI 3.1 document from the shared API spec. Client-safe. */
import { API_ENDPOINTS, RATE_LIMIT_PER_MINUTE } from "@/lib/api-spec";

export function buildOpenApiDocument(origin: string) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of API_ENDPOINTS) {
    const path = endpoint.path.replace(/\{(\w+)\}/g, "{$1}");
    const key = path === "/" ? "/" : path;
    const parameters = endpoint.params
      .filter((p) => p.in !== "body")
      .map((p) => ({
        name: p.name,
        in: p.in === "path" ? "path" : "query",
        required: p.in === "path" ? true : !!p.required,
        description: p.description,
        schema: {
          type: p.type,
          ...(p.enum ? { enum: p.enum } : {}),
          ...(p.default !== undefined ? { default: p.default } : {}),
        },
        ...(p.example !== undefined ? { example: p.example } : {}),
      }));

    const bodyParams = endpoint.params.filter((p) => p.in === "body");
    const requestBody = bodyParams.length
      ? {
          required: bodyParams.some((p) => p.required),
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: bodyParams.filter((p) => p.required).map((p) => p.name),
                properties: Object.fromEntries(
                  bodyParams.map((p) => [p.name, { type: p.type, description: p.description }]),
                ),
              },
            },
          },
        }
      : undefined;

    paths[key] = {
      ...(paths[key] ?? {}),
      [endpoint.method.toLowerCase()]: {
        operationId: endpoint.id.replace(/-/g, "_"),
        summary: endpoint.summary,
        description: endpoint.description,
        tags: [endpoint.group],
        security: endpoint.id === "index" || endpoint.id === "openapi" ? [] : [{ bearerAuth: [] }],
        ...(parameters.length ? { parameters } : {}),
        ...(requestBody ? { requestBody } : {}),
        responses: {
          "200": { description: "Success" },
          "202": { description: "Accepted" },
          "401": { description: "Missing, malformed, revoked or unknown token" },
          "403": { description: "Token lacks the required scope" },
          "404": { description: "Resource not found" },
          "429": { description: "Rate limit exceeded" },
        },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Chaos Subdomain Monitor API",
      version: "1.0.0",
      description: `Token-authenticated REST API for tracked domains, subdomains, discoveries, scans, stats and bulk exports. Rate limit: ${RATE_LIMIT_PER_MINUTE} requests per minute per key.`,
    },
    servers: [
      { url: `${origin}/api/v1`, description: "Primary" },
      { url: `${origin}/api/public/v1`, description: "External mirror" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "chs_live_" },
      },
    },
    security: [{ bearerAuth: [] }],
    paths,
  };
}
