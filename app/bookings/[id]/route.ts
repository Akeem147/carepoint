import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await context.params

  if (!id?.trim()) {
    return NextResponse.json(
      { error: 'Booking ID is required.' },
      { status: 400 },
    )
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, slot_id, name, email, status, created_at')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      console.error('Failed to retrieve booking:', error)

      return NextResponse.json(
        { error: 'Unable to retrieve booking.' },
        { status: 500 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 },
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected booking retrieval error:', error)

    return NextResponse.json(
      { error: 'Unable to retrieve booking.' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  const { id } = await context.params

  if (!id?.trim()) {
    return NextResponse.json(
      { error: 'Booking ID is required.' },
      { status: 400 },
    )
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select('id, slot_id, name, email, status, created_at')
      .maybeSingle()

    if (error) {
      console.error('Failed to cancel booking:', error)

      return NextResponse.json(
        { error: 'Unable to cancel booking.' },
        { status: 500 },
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Booking not found.' },
        { status: 404 },
      )
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error) {
    console.error('Unexpected cancellation error:', error)

    return NextResponse.json(
      { error: 'Unable to cancel booking.' },
      { status: 500 },
    )
  }
}