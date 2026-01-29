
interface Env {
  DB: any;
}

type PagesFunction = (context: {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  params: any;
  data: any;
}) => Response | Promise<Response>;

export const onRequest: PagesFunction = async (context) => {
  const { next, request } = context;

  // 1. Handle CORS Preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    // 2. Execute the actual function
    const response = await next();
    
    // 3. Attach CORS headers to the response
    const newResponse = new Response(response.body, response);
    newResponse.headers.set("Access-Control-Allow-Origin", "*");
    return newResponse;
  } catch (err) {
    // 4. Global Error Catching
    console.error("Middleware Error:", err);
    return new Response(JSON.stringify({ 
      error: "Internal Server Error", 
      message: err instanceof Error ? err.message : String(err) 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
