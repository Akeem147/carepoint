
import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getSlotsFromDatabase() {
  const [slotsResult, bookingsResult] = await Promise.all([
    supabaseAdmin
      .from('slots')
      .select('id, provider, start_at, end_at')
      .order('start_at', { ascending: true }),

    supabaseAdmin
      .from('bookings')
      .select('slot_id')
      .eq('status', 'confirmed'),
  ])

  if (slotsResult.error) throw slotsResult.error
  if (bookingsResult.error) throw bookingsResult.error

  const bookedSlotIds = new Set(
    (bookingsResult.data ?? []).map((booking) => booking.slot_id),
  )

  return (slotsResult.data ?? []).map((slot) => ({
    id: slot.id,
    provider: slot.provider,
    start: slot.start_at,
    end: slot.end_at,
    available:
      new Date(slot.start_at).getTime() > Date.now() &&
      !bookedSlotIds.has(slot.id),
  }))
}
