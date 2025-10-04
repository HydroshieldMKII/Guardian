import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from "@/lib/config";

export async function GET(request: NextRequest) {
  try {
    const backendUrl = getBackendUrl();
    
    const response = await fetch(`${backendUrl}/config/plex/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    // Always return the backend response to preserve structure
    return NextResponse.json(data, { 
      status: response.ok ? 200 : response.status 
    });
    
  } catch (error: any) {
    console.error('Error fetching Plex status:', error);
    
    // Return structured error for backend connection issues
    return NextResponse.json(
      {
        configured: false,
        hasValidCredentials: false,
        connectionStatus: "Backend connection error: Cannot connect to Guardian backend service"
      },
      { status: 500 }
    );
  }
}