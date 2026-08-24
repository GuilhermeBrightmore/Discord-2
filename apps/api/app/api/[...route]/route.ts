import { makeApp } from "@discord2/server-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

let application: ReturnType<typeof makeApp> | undefined;

async function route(request: Request): Promise<Response> {
  try {
    application ??= makeApp();
    return application.fetch(request);
  } catch (error) {
    console.error("FungoCord API sem configuracao de ambiente", error);
    return Response.json(
      {
        error: "A API ainda nao foi configurada na Vercel",
        code: "SERVER_CONFIG_MISSING",
      },
      { status: 503 },
    );
  }
}

export const GET = route;
export const POST = route;
export const PUT = route;
export const PATCH = route;
export const DELETE = route;
export const OPTIONS = route;
