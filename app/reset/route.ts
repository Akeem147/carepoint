
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ResetSlot = {
  id: string
  provider: string
  start: string
  end: string
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.API_SECRET_KEY
  const suppliedKey = request.headers.get('X-API-Key')

  if (!apiKey || suppliedKey !== apiKey) {
    return errorResponse('Unauthorized', 401)
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON request body.', 400)
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    !Array.isArray((body as { slots?: unknown }).slots)
  ) {
    return errorResponse('A slots array is required.', 400)
  }

  const slots = (body as { slots: unknown[] }).slots
  const validatedSlots: ResetSlot[] = []
  const slotIds = new Set<string>()

  for (const item of slots) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return errorResponse('Each slot must be a valid object.', 400)
    }

    const slot = item as Record<string, unknown>
    const { id, provider, start, end } = slot

    if (
      typeof id !== 'string' || !id.trim() ||
      typeof provider !== 'string' || !provider.trim() ||
      typeof start !== 'string' ||
      typeof end !== 'string'
    ) {
      return errorResponse(
        'Each slot requires id, provider, start and end.',
        400,
      )
    }

    const startDate = new Date(start)
    const endDate = new Date(end)

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate.getTime() <= startDate.getTime()
    ) {
      return errorResponse('Invalid slot date or time range.', 400)
    }

    const normalizedId = id.trim()

    if (slotIds.has(normalizedId)) {
      return errorResponse('Duplicate slot IDs are not allowed.', 400)
    }

    slotIds.add(normalizedId)

    validatedSlots.push({
      id: normalizedId,
      provider: provider.trim(),
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    })
  }

  try {
    const { error } = await supabaseAdmin.rpc('reset_booking_data', {
      p_slots: validatedSlots,
    })

    if (error) {
      console.error('Reset operation failed:', error)
      return errorResponse('Unable to reset booking data.', 500)
    }

    return new NextResponse(null, { status: 200 })
  } catch (error) {
    console.error('Unexpected reset error:', error)
    return errorResponse('Unable to reset booking data.', 500)
  }
}
