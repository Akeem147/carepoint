import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API configuration is missing.' },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()

    const response = await fetch(
      new URL('/bookings', request.url),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          ...(request.headers.get('Idempotency-Key')
            ? {
                'Idempotency-Key':
                  request.headers.get('Idempotency-Key')!,
              }
            : {}),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
      },
    )

    const data = await response.json()

    const headers = new Headers()

    const retryAfter = response.headers.get('Retry-After')

    if (retryAfter) {
      headers.set('Retry-After', retryAfter)
    }

    return NextResponse.json(data, {
      status: response.status,
      headers,
    })
  } catch (error) {
    console.error('Patient booking failed:', error)

    return NextResponse.json(
      { error: 'Unable to process your appointment booking.' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'API configuration is missing.' },
      { status: 500 },
    )
  }

  try {
    const searchParams = request.nextUrl.searchParams

    const url = new URL('/bookings', request.url)

    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value)
    })

    const response = await fetch(url, {
      method: 'GET',
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
    console.error('Failed to retrieve patient bookings:', error)

    return NextResponse.json(
      { error: 'Unable to retrieve your bookings.' },
      { status: 500 },
    )
  }
}