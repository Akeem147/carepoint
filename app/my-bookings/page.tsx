
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Search,
  Stethoscope,
  XCircle,
  AlertCircle,
  LoaderCircle,
  X,
  CalendarCheck,
} from 'lucide-react'

import {
  getBookings,
  getSlots,
  cancelBooking,
} from '@/lib/booking-service'

import type {
  Booking,
  BookingWithSlot,
  Slot,
} from '@/types/booking'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ToastType = 'success' | 'error' | 'info'

type ToastState = {
  message: string
  type: ToastType
} | null

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function Toast({
  toast,
  onClose,
}: {
  toast: ToastState
  onClose: () => void
}) {
  if (!toast) return null

  const styles = {
    success: 'border-[#b9dbc5] bg-[#eff8f1] text-[#155c46]',
    error: 'border-[#edcaca] bg-[#fff1f1] text-[#9a4141]',
    info: 'border-[#c9dce9] bg-[#eff7fc] text-[#315d78]',
  }

  const Icon =
    toast.type === 'success'
      ? CheckCircle2
      : toast.type === 'error'
        ? AlertCircle
        : CalendarCheck

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-5 top-5 z-[100] flex w-[calc(100%-2.5rem)] max-w-sm items-start gap-3 rounded-2xl border p-4 shadow-xl ${styles[toast.type]}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" />

      <p className="flex-1 text-sm font-medium">
        {toast.message}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="shrink-0 opacity-60 transition hover:opacity-100"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export default function MyBookingsPage() {
  const [email, setEmail] = useState('')
  const [bookings, setBookings] = useState<BookingWithSlot[]>([])
  const [searched, setSearched] = useState(false)

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const [selected, setSelected] = useState<BookingWithSlot | null>(null)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')

  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    if (!toast) return

    const timer = window.setTimeout(() => {
      setToast(null)
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [toast])

  function showToast(message: string, type: ToastType = 'success') {
    setToast({ message, type })
  }

  function matchBookings(
    records: Booking[],
    slots: Slot[],
  ): BookingWithSlot[] {
    return records.flatMap((booking) => {
      const slot = slots.find(
        (item) => item.id === booking.slot_id,
      )

      if (!slot) return []

      return [{
        ...booking,
        slot,
      }]
    })
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError('Please enter the email address you used when booking.')
      showToast('Enter your booking email address.', 'error')
      return
    }

    setLoading(true)
    setError('')
    setSearched(false)
    setBookings([])
    setNextCursor(null)
    setSelected(null)

    try {
      // Fetch bookings and available slot records together.
      const [bookingResult, slots] = await Promise.all([
        getBookings(normalizedEmail, 10),
        getSlots(),
      ])

      const matchedBookings = matchBookings(
        bookingResult.bookings,
        slots,
      )

      setBookings(matchedBookings)
      setNextCursor(bookingResult.next_cursor)
      setSearched(true)

      if (matchedBookings.length > 0) {
        showToast(
          `${matchedBookings.length} appointment${matchedBookings.length === 1 ? '' : 's'} found.`,
          'success',
        )
      } else {
        showToast('No appointments were found for this email.', 'info')
      }
    } catch (err) {
      const message = getErrorMessage(
        err,
        'Unable to find your bookings. Please try again.',
      )

      setError(message)
      setSearched(false)
      showToast(message, 'error')
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return

    setLoadingMore(true)
    setError('')

    try {
      const [bookingResult, slots] = await Promise.all([
        getBookings(email.trim().toLowerCase(), 10, nextCursor),
        getSlots(),
      ])

      const matchedBookings = matchBookings(
        bookingResult.bookings,
        slots,
      )

      setBookings((current) => [
        ...current,
        ...matchedBookings,
      ])

      setNextCursor(bookingResult.next_cursor)

      showToast(
        matchedBookings.length > 0
          ? 'More appointments loaded.'
          : 'There are no more appointments to display.',
        'success',
      )
    } catch (err) {
      const message = getErrorMessage(
        err,
        'Unable to load more bookings.',
      )

      setError(message)
      showToast(message, 'error')
    } finally {
      setLoadingMore(false)
    }
  }

  async function confirmCancel() {
    if (!selected || cancelling) return

    setCancelling(true)
    setCancelError('')

    try {
      const cancelled = await cancelBooking(selected.id)

      const updatedBooking: BookingWithSlot = {
        ...selected,
        ...cancelled,
        slot: selected.slot,
      }

      setBookings((current) =>
        current.map((booking) =>
          booking.id === updatedBooking.id
            ? updatedBooking
            : booking,
        ),
      )

      setSelected(updatedBooking)
      setCancelOpen(false)

      showToast(
        'Your appointment has been cancelled. The slot is now available.',
        'success',
      )
    } catch (err) {
      const message = getErrorMessage(
        err,
        'Unable to cancel this appointment. Please try again.',
      )

      setCancelError(message)
      showToast(message, 'error')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#1e2c26]">
      <Toast
        toast={toast}
        onClose={() => setToast(null)}
      />

      {/* Header */}
      <header className="border-b border-[#dce8e1] bg-white">
        <div className="mx-auto flex h-[72px] max-w-5xl items-center justify-between px-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#155c46] text-white">
              <Stethoscope className="size-5" />
            </span>

            <span className="font-semibold tracking-tight">
              CarePoint <span className="text-[#7aa58f]">Clinic</span>
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm cursor-pointer font-medium text-[#155c46] hover:text-[#0d4735]"
          >
            Book an appointment
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[#60766b] transition hover:text-[#155c46]"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>

        {/* Page heading */}
        <div className="mt-8 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5f967a]">
            Patient portal
          </p>

          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#173b2d]">
            My bookings
          </h1>

          <p className="mt-3 text-lg text-[#60766b]">
            Enter your email to view upcoming and past appointments.
          </p>
        </div>

        {/* Search */}
        <Card className="mt-8 rounded-3xl border-[#dce8e1] shadow-sm">
          <CardContent className="p-5 sm:p-7">
            <form
              onSubmit={search}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-[#244438]">
                Email address

                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setError('')
                  }}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                  className="h-12 w-full rounded-xl border border-[#cfe1d7] bg-white px-4 font-normal text-[#244438] outline-none transition placeholder:text-[#a0b1a8] focus:border-[#80ad91] focus:ring-2 focus:ring-[#8dbda4]/30 disabled:opacity-60"
                />
              </label>

              <Button
                type="submit"
                disabled={loading}
                className="h-12 rounded-xl cursor-pointer bg-[#155c46] px-7 text-white hover:bg-[#0d4735] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="mr-2 size-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Find my bookings
                  </>
                )}
              </Button>
            </form>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl border border-[#edcaca] bg-[#fff1f1] p-3 text-sm text-[#9a4141]"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Initial state */}
        {!searched && !loading && (
          <div className="mt-12 rounded-3xl border border-dashed border-[#d5e4da] px-5 py-12 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#eaf3ed] text-[#5f967a]">
              <CalendarDays className="size-7" />
            </div>

            <h2 className="mt-5 font-semibold text-[#244438]">
              Your appointments in one place
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#789087]">
              Enter the email address you used when booking to retrieve your appointment details.
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <section className="mt-10">
            <div className="mb-5 flex items-center gap-3">
              <LoaderCircle className="size-5 animate-spin text-[#155c46]" />
              <p className="text-sm font-medium text-[#60766b]">
                Looking for your appointments...
              </p>
            </div>

            <div className="grid gap-4">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="animate-pulse rounded-3xl border border-[#dce8e1] bg-white p-6"
                >
                  <div className="h-4 w-32 rounded bg-[#e8eee9]" />
                  <div className="mt-5 h-5 w-48 rounded bg-[#e8eee9]" />
                  <div className="mt-4 h-4 w-64 rounded bg-[#edf1ed]" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Search results */}
        {searched && !loading && (
          <section className="mt-10">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-xl font-semibold text-[#244438]">
                  Your appointments
                </h2>

                <p className="mt-1 text-sm text-[#789087]">
                  {bookings.length} booking{bookings.length === 1 ? '' : 's'} found
                </p>
              </div>

              <Badge className="w-fit rounded-full bg-[#e2f0e8] px-3 py-1 text-[#155c46]">
                {email.trim().toLowerCase()}
              </Badge>
            </div>

            {/* Empty state */}
            {bookings.length === 0 && (
              <div className="mt-5 rounded-3xl border border-dashed border-[#cfe1d7] bg-white px-5 py-16 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#eaf3ed] text-[#8dbda4]">
                  <CalendarDays className="size-7" />
                </div>

                <h3 className="mt-4 font-semibold text-[#244438]">
                  No bookings found
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#789087]">
                  We couldn't find any appointments associated with this email address. Check your email or book a new appointment.
                </p>
                <Link
                  href="/#appointments"
                  className="mt-6 cursor-pointer inline-flex items-center justify-center rounded-full bg-[#155c46] px-6 py-3 text-white transition-colors hover:bg-[#0d4735]"
                >
                  Find an appointment
                </Link>
              </div>
            )}

            {/* Booking cards */}
            {bookings.length > 0 && (
              <div className="mt-5 grid gap-4">
                {bookings.map((booking) => (
                  <Card
                    key={booking.id}
                    className="rounded-3xl border-[#dce8e1] bg-white shadow-sm transition hover:shadow-md"
                  >
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-[#155c46]">
                              {booking.id}
                            </span>

                            <Badge
                              className={
                                booking.status === 'confirmed'
                                  ? 'bg-[#e2f0e8] text-[#155c46]'
                                  : 'bg-[#f4eaea] text-[#9a4e4e]'
                              }
                            >
                              {booking.status === 'confirmed' ? (
                                <CheckCircle2 className="mr-1 size-3.5" />
                              ) : (
                                <XCircle className="mr-1 size-3.5" />
                              )}

                              {booking.status === 'confirmed'
                                ? 'Confirmed'
                                : 'Cancelled'}
                            </Badge>
                          </div>

                          <h3 className="mt-3 font-semibold text-[#244438]">
                            {booking.slot.provider}
                          </h3>

                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#60766b]">
                            <span className="flex items-center gap-2">
                              <CalendarDays className="size-4 text-[#80a58e]" />
                              {formatDate(booking.slot.start)}
                            </span>

                            <span className="flex items-center gap-2">
                              <Clock3 className="size-4 text-[#80a58e]" />
                              {formatTime(booking.slot.start)} – {formatTime(booking.slot.end)}
                            </span>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 rounded-full cursor-pointer border-[#cfe1d7] text-[#155c46] hover:bg-[#f2f8f4]"
                          onClick={() => {
                            setSelected(booking)
                            setCancelError('')
                          }}
                        >
                          View details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {nextCursor && (
              <div className="mt-7 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loadingMore}
                  onClick={loadMore}
                  className="rounded-full border-[#cfe1d7] px-6 text-[#155c46]"
                >
                  {loadingMore ? (
                    <>
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      Loading bookings...
                    </>
                  ) : (
                    'Load more bookings'
                  )}
                </Button>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dce8e1] px-5 py-8 text-center text-sm text-[#789087]">
        CarePoint Clinic · Your care, your time.
      </footer>

      {/* Booking details dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null)
            setCancelError('')
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#173b2d]">
              Booking details
            </DialogTitle>

            <DialogDescription>
              Review your appointment information.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex flex-col gap-5">
              <div className="rounded-2xl bg-[#f2f8f4] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[#789087]">
                    Booking reference:
                  </span>

                  <strong className="break-all text-sm text-[#155c46]">
                    {selected.id}
                  </strong>
                </div>

                <div className="mt-4">
                  <p className="font-semibold text-[#244438]">
                    {selected.slot.provider}
                  </p>

                  <p className="mt-1 text-sm text-[#60766b]">
                    {formatDate(selected.slot.start)}
                  </p>

                  <p className="mt-1 text-sm text-[#60766b]">
                    {formatTime(selected.slot.start)} – {formatTime(selected.slot.end)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-sm mt-4 mb-6">
                <div>
                  <span className="text-[#789087]">Patient:</span>
                  <p className="font-medium text-[#244438]">
                    {selected.name}
                  </p>
                </div>

                <div>
                  <span className="text-[#789087]">Email address:</span>
                  <p className="font-medium text-[#244438]">
                    {selected.email}
                  </p>
                </div>

                <div>
                  <span className="text-[#789087]">Booking status:</span>

                  <p
                    className={
                      selected.status === 'confirmed'
                        ? 'font-medium text-[#155c46]'
                        : 'font-medium text-[#9a4e4e]'
                    }
                  >
                    {selected.status === 'confirmed'
                      ? 'Confirmed'
                      : 'Cancelled'}
                  </p>
                </div>
              </div>

              {cancelError && (
                <p
                  role="alert"
                  className="rounded-xl border border-[#edcaca] bg-[#fff1f1] p-3 text-sm text-[#9a4141]"
                >
                  {cancelError}
                </p>
              )}

              {selected.status === 'confirmed' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full cursor-pointer border-[#d6bcbc] text-[#9a4e4e] hover:bg-[#fff7f7]"
                  onClick={() => {
                    setCancelError('')
                    setCancelOpen(true)
                  }}
                >
                  Cancel appointment
                </Button>
              ) : (
                <p className="rounded-xl bg-[#f4eaea] p-3 text-center text-sm text-[#9a4e4e]">
                  This appointment has been cancelled.
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancellation confirmation */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (!cancelling) setCancelOpen(open)
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-[#173b2d]">
              Cancel appointment?
            </DialogTitle>

            <DialogDescription>
              This will release the appointment slot for another patient.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              className="flex-1 rounded-full cursor-pointer"
              onClick={() => setCancelOpen(false)}
            >
              Go back
            </Button>

            <Button
              type="button"
              disabled={cancelling}
              className="flex-1 rounded-full cursor-pointer bg-[#9a4e4e] hover:bg-[#803f3f]"
              onClick={confirmCancel}
            >
              {cancelling ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Confirm cancellation'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
