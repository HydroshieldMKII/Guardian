import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/config";

export async function POST() {
  try {
    const response = await fetch(`${getBackendUrl()}/config/test-plex-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    
    // Always return the backend response as-is to preserve error structure
    return NextResponse.json(data, { 
      status: response.ok ? 200 : response.status 
    });
    
  } catch (error: any) {
    console.error("Failed to test Plex connection:", error);
    
    // Return a structured error response for backend connection issues
    return NextResponse.json(
      {
        success: false,
        errorCode: "BACKEND_CONNECTION_ERROR",
        message: "Cannot connect to Guardian backend",
        details: "Please ensure the backend service is running and accessible"
      },
      { status: 500 }
    );
  }
}
