
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [slotsResult, bookingsResult] = await Promise.all([
      supabaseAdmin
        .from('slots')
        .select('*', { count: 'exact', head: true }),

      supabaseAdmin
        .from('bookings')
        .select('*', { count: 'exact', head: true }),
    ])

    if (slotsResult.error || bookingsResult.error) {
      throw new Error('Database query failed.')
    }

    return NextResponse.json({
      status: 'connected',
      database: 'Supabase',
      slots: slotsResult.count ?? 0,
      bookings: bookingsResult.count ?? 0,
    })
  } catch (error) {
    console.error('Database health check failed:', error)

    return NextResponse.json(
      { status: 'error', message: 'Database connection failed.' },
      { status: 500 },
    )
  }
}
