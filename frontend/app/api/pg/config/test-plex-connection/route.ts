import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.DEPLOYMENT_MODE === "standalone"
    ? "http://localhost:3001"
    : "http://backend:3001";

export async function POST() {
  try {
    const response = await fetch(`${BACKEND_URL}/config/test-plex-connection`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Failed to test Plex connection:", error);
    
    // Handle specific connection errors
    let errorMessage = "Failed to test connection";
    
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = "Backend server is not reachable. Please ensure the backend service is running.";
    } else if (error.message?.includes('fetch failed')) {
      errorMessage = "Unable to connect to backend service. Please check if the backend is running and accessible.";
    } else if (error.message?.includes('timeout')) {
      errorMessage = "Backend service timeout. The service may be overloaded or not responding.";
    } else if (error.message?.includes('Backend responded with')) {
      errorMessage = `Backend service error: ${error.message}`;
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
