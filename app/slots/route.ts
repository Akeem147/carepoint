
import { NextRequest, NextResponse } from 'next/server'
import { getSlotsFromDatabase } from '@/lib/booking-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const slots = await getSlotsFromDatabase()
    return NextResponse.json(slots)
  } catch (error) {
    console.error('Failed to retrieve slots:', error)

    return NextResponse.json(
      { error: 'Unable to retrieve appointment slots.' },
      { status: 500 },
    )
  }
}
