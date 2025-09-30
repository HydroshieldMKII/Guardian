import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const backendUrl = process.env.DEPLOYMENT_MODE === 'standalone' 
      ? 'http://localhost:3001'
      : 'http://backend:3001';
    
    const response = await fetch(`${backendUrl}/config/plex/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch Plex status from backend' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching Plex status:', error);
    
    let errorMessage = 'Failed to connect to backend';
    
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Backend server is not reachable. Please ensure the backend service is running.';
    } else if (error.message?.includes('fetch failed')) {
      errorMessage = 'Unable to connect to backend service. Please check if the backend is running and accessible.';
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}