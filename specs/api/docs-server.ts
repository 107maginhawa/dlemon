import openApiSpec from "./dist/openapi/openapi.json" with { type: "json" };
import { normalizeOpenAPISpec } from "./src/utils/openapi";

/**
 * Simple Bun server to serve Scalar API documentation
 * Serves the generated OpenAPI specification with Scalar interface
 */

const PORT = process.env.PORT || 7230;

// HTML template with Scalar initialization
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
    <title>Monobase Application Platform API Documentation</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
    <script
        id="api-reference"
        data-url="/openapi.json"
        data-configuration='{
            "theme": "purple",
            "layout": "modern",
            "defaultHttpClient": {
                "targetKey": "javascript",
                "clientKey": "fetch"
            },
            "spec": {
                "url": "/openapi.json"
            }
        }'></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.34.6/dist/browser/standalone.min.js"></script>
</body>
</html>
`;

// Start the server
const server = Bun.serve({
  port: PORT,
  
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Set CORS headers for all requests
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle OPTIONS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { 
        status: 200, 
        headers 
      });
    }

    try {
      // Serve OpenAPI JSON specification
      if (pathname === "/openapi.json") {
        // Normalize the spec before serving (handles allOf patterns)
        const normalizedSpec = normalizeOpenAPISpec(openApiSpec);
        return new Response(JSON.stringify(normalizedSpec), {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "application/json"
          }
        });
      }

      // Serve Scalar documentation interface
      if (pathname === "/" || pathname === "/docs") {
        return new Response(HTML_TEMPLATE, {
          status: 200,
          headers: {
            ...headers,
            "Content-Type": "text/html"
          }
        });
      }

      // Handle 404 for other routes
      return new Response(
        JSON.stringify({ 
          error: "Not Found",
          message: "Available routes: / (docs), /openapi.json (spec)"
        }), 
        { 
          status: 404, 
          headers: {
            ...headers,
            "Content-Type": "application/json"
          }
        }
      );

    } catch (error) {
      console.error("Server error:", error);
      
      return new Response(
        JSON.stringify({ 
          error: "Internal Server Error",
          message: error instanceof Error ? error.message : "Unknown error"
        }),
        { 
          status: 500, 
          headers: {
            ...headers,
            "Content-Type": "application/json"
          }
        }
      );
    }
  },

  error(error) {
    console.error("Server error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Server Error",
        message: error.message 
      }),
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
});

console.log(`🚀 API Documentation server running at http://localhost:${PORT}`);
console.log(`📖 Documentation: http://localhost:${PORT}`);
console.log(`📄 OpenAPI Spec: http://localhost:${PORT}/openapi.json`);
console.log(`🔄 Make sure to run 'bun run build' first to generate the OpenAPI spec`);
