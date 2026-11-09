import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API configuration is missing.' },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(
      new URL('/slots', request.url),
      {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
        cache: 'no-store',
      },
    )

    const data = await response.json()

    return NextResponse.json(data, {
      status: response.status,
    })
  } catch (error) {
    console.error('Failed to retrieve patient slots:', error)

    return NextResponse.json(
      { error: 'Unable to load appointment slots.' },
      { status: 500 },
    )
  }
}