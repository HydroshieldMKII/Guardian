import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NODE_ENV === "production"
    ? "http://backend:3001"
    : "http://localhost:3001";

export async function POST() {
  try {
    const response = await fetch(`${BACKEND_URL}/config/test-plex-connection`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to test Plex connection:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to test connection",
      },
      { status: 500 }
    );
  }
}
