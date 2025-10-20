import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/config";

export async function GET() {
  try {
    const response = await fetch(`${getBackendUrl()}/config`);

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to fetch config:", error);

    let errorMessage = "Failed to fetch configuration";

    if (
      error.cause?.code === "ECONNREFUSED" ||
      error.message?.includes("ECONNREFUSED")
    ) {
      errorMessage =
        "Backend server is not reachable. Please ensure the backend service is running.";
    } else if (error.message?.includes("fetch failed")) {
      errorMessage =
        "Unable to connect to backend service. Please check if the backend is running and accessible.";
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${getBackendUrl()}/config`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to update config:", error);

    let errorMessage = "Failed to update configuration";

    if (
      error.cause?.code === "ECONNREFUSED" ||
      error.message?.includes("ECONNREFUSED")
    ) {
      errorMessage =
        "Backend server is not reachable. Please ensure the backend service is running.";
    } else if (error.message?.includes("fetch failed")) {
      errorMessage =
        "Unable to connect to backend service. Please check if the backend is running and accessible.";
    } else if (error.message?.includes("Backend responded with")) {
      errorMessage = `Backend service error: ${error.message}`;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
