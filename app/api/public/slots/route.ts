
import { NextResponse } from 'next/server'
import { getSlotsFromDatabase } from '@/lib/booking-server'

export const dynamic = 'force-dynamic'

export async function GET() {
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
