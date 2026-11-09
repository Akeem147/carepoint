
import type {
  Booking,
  BookingWithSlot,
  Slot,
} from '@/types/booking'

async function apiRequest<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    cache: 'no-store',
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error || 'Something went wrong. Please try again.',
    )
  }

  return data as T
}

// Get live appointment slots from the database.
export async function getSlots(): Promise<Slot[]> {
  return apiRequest<Slot[]>('/api/patient/slots')
}

// Create a real appointment booking.
export async function createBooking(data: {
  slot_id: string
  name: string
  email: string
}): Promise<Booking> {
  return apiRequest<Booking>('/api/patient/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}

// Retrieve bookings belonging to a patient.
export async function getBookings(
  email: string,
  limit = 10,
  cursor?: string,
): Promise<{
  bookings: Booking[]
  next_cursor: string | null
}> {
  if (!email.trim()) {
    throw new Error('Email address is required.')
  }

  const params = new URLSearchParams({
    email: email.trim(),
    limit: String(limit),
  })

  if (cursor) {
    params.set('cursor', cursor)
  }

  return apiRequest(
    `/api/patient/bookings?${params.toString()}`,
  )
}

// Retrieve one booking and its associated appointment slot.
export async function getBookingById(
  id: string,
): Promise<BookingWithSlot | null> {
  const response = await fetch(
    `/api/patient/bookings/${encodeURIComponent(id)}`,
    { cache: 'no-store' },
  )

  if (response.status === 404) {
    return null
  }

  const booking = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      booking?.error || 'Unable to retrieve booking.',
    )
  }

  const slots = await getSlots()
  const slot = slots.find(
    (item) => item.id === booking.slot_id,
  )

  if (!slot) {
    return null
  }

  return {
    ...booking,
    slot,
  } as BookingWithSlot
}

// Cancel an existing appointment.
export async function cancelBooking(
  id: string,
): Promise<Booking> {
  return apiRequest<Booking>(
    `/api/patient/bookings/${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    },
  )
}
