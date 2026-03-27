import { NextResponse } from "next/server";
import { generateOpenApiSpec } from "@/lib/api/openapi-schema";

export async function GET() {
  const spec = generateOpenApiSpec();
  return NextResponse.json(spec, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
