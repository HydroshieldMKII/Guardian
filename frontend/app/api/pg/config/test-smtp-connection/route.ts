import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/config";

export async function POST() {
  try {
    const response = await fetch(
      `${getBackendUrl()}/config/test-smtp-connection`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data = await response.json();

    // Always return the backend response as-is to preserve error structure
    return NextResponse.json(data, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error: any) {
    console.error("Failed to test SMTP connection:", error);

    // Return a structured error response for backend connection issues
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_CONNECTION_ERROR",
        message: "Cannot connect to Guardian backend",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
