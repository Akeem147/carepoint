
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  // 1. Authenticate the request.
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return errorResponse('Unauthorized', 401)
  }

  // 2. Read and validate JSON.
  let body: unknown

  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON request body.', 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return errorResponse('Invalid request body.', 400)
  }

  const data = body as Record<string, unknown>

  const slotId = data.slot_id
  const name = data.name
  const email = data.email

  if (typeof slotId !== 'string' || !slotId.trim()) {
    return errorResponse('slot_id is required.', 400)
  }

  if (typeof name !== 'string' || !name.trim()) {
    return errorResponse('name is required.', 400)
  }

  if (typeof email !== 'string' || !email.trim()) {
    return errorResponse('email is required.', 400)
  }

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = name.trim()
  const normalizedSlotId = slotId.trim()

  if (!emailPattern.test(normalizedEmail)) {
    return errorResponse('Invalid email address.', 400)
  }

  // 3. Prepare idempotency information.
  const idempotencyKey = request.headers.get('Idempotency-Key')

  const requestHash = createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')

  // 4. Execute the atomic database transaction.
  const { data: result, error } = await supabaseAdmin.rpc(
    'create_booking_tx',
    {
      p_slot_id: normalizedSlotId,
      p_name: normalizedName,
      p_email: normalizedEmail,
      p_idempotency_key: idempotencyKey,
      p_request_hash: idempotencyKey ? requestHash : null,
    },
  )

  if (error) {
    console.error('Booking transaction failed:', error)

    return errorResponse('Unable to process booking.', 500)
  }

  if (
    !result ||
    typeof result !== 'object' ||
    typeof result.status !== 'number' ||
    !result.body
  ) {
    console.error('Unexpected booking transaction response:', result)

    return errorResponse('Unexpected booking response.', 500)
  }

  // 5. Return the database response with its original status.
  const headers: HeadersInit = {}

  if (result.status === 429 && result.retry_after) {
    headers['Retry-After'] = String(result.retry_after)
  }

  return NextResponse.json(result.body, {
    status: result.status,
    headers,
  })
}


type BookingCursor = {
  created_at: string
  id: string
}

function encodeCursor(cursor: BookingCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(value: string): BookingCursor | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    )

    if (
      typeof decoded.created_at !== 'string' ||
      Number.isNaN(Date.parse(decoded.created_at)) ||
      typeof decoded.id !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(decoded.id)
    ) {
      return null
    }

    return {
      created_at: decoded.created_at,
      id: decoded.id,
    }
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return errorResponse('Unauthorized', 401)
  }

  const searchParams = request.nextUrl.searchParams

  const email = searchParams.get('email')?.trim().toLowerCase()
  const limitParam = searchParams.get('limit')
  const cursorParam = searchParams.get('cursor')

  if (!email) {
    return errorResponse('email is required.', 400)
  }

  if (!emailPattern.test(email)) {
    return errorResponse('Invalid email address.', 400)
  }

  let limit = 10

  if (limitParam !== null) {
    if (!/^\d+$/.test(limitParam)) {
      return errorResponse('limit must be a number between 1 and 50.', 400)
    }

    limit = Number(limitParam)

    if (limit < 1 || limit > 50) {
      return errorResponse('limit must be between 1 and 50.', 400)
    }
  }

  let cursor: BookingCursor | null = null

  if (cursorParam) {
    cursor = decodeCursor(cursorParam)

    if (!cursor) {
      return errorResponse('Invalid cursor.', 400)
    }
  }

  try {
    let query = supabaseAdmin
      .from('bookings')
      .select('id, slot_id, name, email, status, created_at')
      .eq('email', email)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .limit(limit + 1)

    if (cursor) {
      query = query.or(
        `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`,
      )
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to retrieve bookings:', error)
      return errorResponse('Unable to retrieve bookings.', 500)
    }

    const rows = data ?? []
    const hasMore = rows.length > limit
    const bookings = rows.slice(0, limit)

    const nextCursor =
      hasMore && bookings.length > 0
        ? encodeCursor({
            created_at: bookings[bookings.length - 1].created_at,
            id: bookings[bookings.length - 1].id,
          })
        : null

    return NextResponse.json({
      bookings,
      next_cursor: nextCursor,
    })
  } catch (error) {
    console.error('Unexpected error retrieving bookings:', error)
    return errorResponse('Unable to retrieve bookings.', 500)
  }
}