import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string }>
}

async function forwardBookingRequest(
  request: NextRequest,
  context: RouteContext,
  method: 'GET' | 'DELETE',
) {
  const apiKey = process.env.API_SECRET_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API configuration is missing.' },
      { status: 500 },
    )
  }

  try {
    const { id } = await context.params

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Booking ID is required.' },
        { status: 400 },
      )
    }

    const url = new URL(
      `/bookings/${encodeURIComponent(id)}`,
      request.url,
    )

    const response = await fetch(url, {
      method,
      headers: {
        'X-API-Key': apiKey,
      },
      cache: 'no-store',
    })

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
    })
  } catch (error) {
    console.error(`Patient booking ${method} failed:`, error)

    return NextResponse.json(
      { error: 'Unable to process your booking request.' },
      { status: 500 },
    )
  }
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardBookingRequest(request, context, 'GET')
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
) {
  return forwardBookingRequest(request, context, 'DELETE')
}