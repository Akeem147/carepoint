
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Menu,
  ShieldCheck,
  Stethoscope,
  Users,
  X,
} from 'lucide-react'

import { getSlots, createBooking } from '@/lib/booking-service'
import type { Booking, Slot } from '@/types/booking'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  type: ToastType
  message: string
} | null

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))

const dateKey = (value: string) => value.slice(0, 10)

export default function HomePage() {
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [slotsError, setSlotsError] = useState('')

  const [selectedDate, setSelectedDate] = useState('all')
  const [selectedProvider, setSelectedProvider] = useState('all')

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [confirmedSlot, setConfirmedSlot] = useState<Slot | null>(null)

  const [mobileOpen, setMobileOpen] = useState(false)

  const [form, setForm] = useState({
    name: '',
    email: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const [toast, setToast] = useState<ToastState>(null)

  // Show a notification.
  const showToast = useCallback(
    (type: ToastType, message: string) => {
      setToast({ type, message })
    },
    [],
  )

  // Automatically dismiss notifications.
  useEffect(() => {
    if (!toast) return

    const timeout = window.setTimeout(() => {
      setToast(null)
    }, 4500)

    return () => window.clearTimeout(timeout)
  }, [toast])

  // Load real appointment slots from the database.
  const loadSlots = useCallback(async () => {
    setSlotsLoading(true)
    setSlotsError('')

    try {
      const result = await getSlots()
      setSlots(result)
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load appointments.'

      setSlotsError(message)
      showToast('error', message)
    } finally {
      setSlotsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadSlots()
  }, [loadSlots])

  const dates = useMemo(
    () => [...new Set(slots.map((slot) => dateKey(slot.start)))],
    [slots],
  )

  const providers = useMemo(
    () => [...new Set(slots.map((slot) => slot.provider))],
    [slots],
  )

  const filteredSlots = useMemo(
    () =>
      slots.filter(
        (slot) =>
          (selectedDate === 'all' ||
            dateKey(slot.start) === selectedDate) &&
          (selectedProvider === 'all' ||
            slot.provider === selectedProvider),
      ),
    [slots, selectedDate, selectedProvider],
  )

  function scrollToAppointments() {
    document
      .getElementById('appointments')
      ?.scrollIntoView({ behavior: 'smooth' })

    setMobileOpen(false)
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {}

    if (!form.name.trim()) {
      nextErrors.name = 'Please enter your full name.'
    }

    if (!form.email.trim()) {
      nextErrors.email = 'Please enter your email address.'
    } else if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      nextErrors.email = 'Please enter a valid email address.'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      showToast('error', 'Please correct the highlighted fields.')
      return false
    }

    return true
  }

  function openBookingModal(slot: Slot) {
    setSelectedSlot(slot)
    setErrors({})
    setForm({ name: '', email: '' })
  }

  function closeBookingModal() {
    if (submitting) return

    setSelectedSlot(null)
    setErrors({})
  }

  async function submitBooking(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (submitting) return
    if (!validateForm()) return

    if (!selectedSlot) {
      showToast('error', 'Please select an appointment first.')
      return
    }

    const slotBeingBooked = selectedSlot

    setSubmitting(true)
    setErrors({})

    try {
      const result = await createBooking({
        slot_id: slotBeingBooked.id,
        name: form.name.trim(),
        email: form.email.trim(),
      })

      // Preserve the appointment information for confirmation.
      setConfirmedSlot(slotBeingBooked)
      setBooking(result)

      // Close and clear the booking form.
      setSelectedSlot(null)
      setForm({ name: '', email: '' })

      showToast(
        'success',
        'Your appointment has been successfully booked!',
      )

      // Refresh availability from Supabase.
      try {
        const updatedSlots = await getSlots()
        setSlots(updatedSlots)
      } catch {
        // The booking succeeded, so keep the slot unavailable locally.
        setSlots((currentSlots) =>
          currentSlots.map((slot) =>
            slot.id === result.slot_id
              ? { ...slot, available: false }
              : slot,
          ),
        )
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to book this appointment. Please try again.'

      setErrors({ form: message })
      showToast('error', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f7faf8] text-[#1e2c26]">

      {/* Toast notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed right-4 top-4 z-[100] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-top-2"
        >
          <div
            className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-xl ${toast.type === 'success'
                ? 'border-[#b8d9c5]'
                : toast.type === 'error'
                  ? 'border-red-200'
                  : 'border-[#cfe1d7]'
              }`}
          >
            <span
              className={`mt-0.5 ${toast.type === 'success'
                  ? 'text-[#278052]'
                  : toast.type === 'error'
                    ? 'text-red-600'
                    : 'text-[#155c46]'
                }`}
            >
              {toast.type === 'success' ? (
                <CheckCircle2 size={21} />
              ) : toast.type === 'error' ? (
                <AlertCircle size={21} />
              ) : (
                <Clock3 size={21} />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#244438]">
                {toast.type === 'success'
                  ? 'Success'
                  : toast.type === 'error'
                    ? 'Something went wrong'
                    : 'Please wait'}
              </p>

              <p className="mt-1 text-sm leading-5 text-[#60766b]">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setToast(null)}
              className="rounded-lg p-1 text-[#789087] hover:bg-[#f2f8f4]"
              aria-label="Dismiss notification"
            >
              <X size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#dce8e1] bg-[#f7faf8]/95 backdrop-blur">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="CarePoint Clinic home"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#155c46] text-white">
              <Stethoscope />
            </span>

            <span className="text-lg font-semibold tracking-tight">
              CarePoint <span className="text-[#7aa58f]">Clinic</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <button
              type="button"
              onClick={scrollToAppointments}
              className="text-[#155c46] cursor-pointer"
            >
              Book an appointment
            </button>

            <Link
              href="/my-bookings"
              className="text-[#5d7167] hover:text-[#155c46]"
            >
              My bookings
            </Link>

            <Button
              type="button"
              className="rounded-full cursor-pointer bg-[#155c46] px-5 hover:bg-[#0d4735]"
              onClick={scrollToAppointments}
            >
              Book appointment
            </Button>
          </nav>

          <button
            type="button"
            className="rounded-lg p-2 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>

        {mobileOpen && (
          <nav className="flex flex-col gap-4 border-t border-[#dce8e1] px-5 py-5 md:hidden">
            <button
              type="button"
              onClick={scrollToAppointments}
              className="text-left cursor-pointer"
            >
              Book an appointment
            </button>

            <Link
              href="/my-bookings"
              onClick={() => setMobileOpen(false)}
            >
              My bookings
            </Link>
          </nav>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-24 lg:pt-22">
          <div>
            <Badge className="mb-6 rounded-full bg-[#e2f0e8] px-4 py-2 text-[#155c46] hover:bg-[#e2f0e8]">
              <ShieldCheck data-icon="inline-start" />
              Trusted care, close to home
            </Badge>

            <h1 className="max-w-2xl text-5xl font-semibold leading-[1.06] tracking-[-0.04em] text-[#173b2d] sm:text-6xl">
              Your health deserves{' '}
              <span className="text-[#5f967a]">
                convenient care.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-[#60766b]">
              Find a time that works for you and book with a trusted
              CarePoint provider in just a few simple steps.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="rounded-full cursor-pointer bg-[#155c46] px-6 hover:bg-[#0d4735]"
                onClick={scrollToAppointments}
              >
                Find an appointment
                <ArrowRight data-icon="inline-end" />
              </Button>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-full cursor-pointer cursor-pointer border-[#bdd5c8] bg-transparent px-6 text-[#155c46] hover:bg-white"
                onClick={() => {
                  window.location.href = '/my-bookings'
                }}
              >
                View my bookings
              </Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-[#60766b]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-[#5f967a]" />
                Flexible appointment times
              </span>

              <span className="flex items-center gap-2">
                <CheckCircle2 className="text-[#5f967a]" />
                Caring clinicians
              </span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-[#e2f0e8]/70 blur-2xl" />

            <div className="relative overflow-hidden rounded-[2rem] border border-[#cfe1d7] bg-[#dceee4] p-6 shadow-xl shadow-[#2e644d]/10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#5a8170]">
                    Care that fits your day
                  </p>

                  <h2 className="mt-1 text-2xl font-semibold text-[#173b2d]">
                    You&apos;re in good hands
                  </h2>
                </div>

                <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-[#155c46] shadow-sm">
                  <HeartIcon />
                </span>
              </div>

              <div className="mt-6 rounded-3xl bg-white/90 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-[#dceee4] text-lg font-semibold text-[#155c46]">
                    AO
                  </div>

                  <div>
                    <p className="font-semibold text-[#173b2d]">
                      Dr. Amara Okafor
                    </p>
                    <p className="text-sm text-[#6c8277]">
                      General practitioner
                    </p>
                  </div>

                  <Badge className="ml-auto bg-[#e2f0e8] text-[#155c46] hover:bg-[#e2f0e8]">
                    Available
                  </Badge>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#f2f8f4] p-4">
                    <CalendarDays className="mb-2 text-[#5f967a]" />
                    <p className="text-sm font-medium">
                      10 Dec 2026
                    </p>
                    <p className="text-xs text-[#6c8277]">
                      Next available
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f2f8f4] p-4">
                    <Clock3 className="mb-2 text-[#5f967a]" />
                    <p className="text-sm font-medium">
                      30 minutes
                    </p>
                    <p className="text-xs text-[#6c8277]">
                      Consultation
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between px-1 text-sm text-[#5a8170]">
                <span className="flex items-center gap-2">
                  <Users />
                  2,000+ patients cared for
                </span>
                <span>Since 2012</span>
              </div>
            </div>
          </div>
        </section>

        {/* Available appointments */}
        <section
          id="appointments"
          className="scroll-mt-24 border-t border-[#e1ebe5] bg-white px-5 py-16 lg:px-8 lg:py-20"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#5f967a]">
                  Find your time
                </p>

                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#173b2d]">
                  Available appointments
                </h2>

                <p className="mt-2 text-[#6c8277]">
                  Choose a time that works for you.
                </p>
              </div>

              {!slotsLoading && !slotsError && slots.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  <select
                    value={selectedDate}
                    onChange={(event) =>
                      setSelectedDate(event.target.value)
                    }
                    className="rounded-full border border-[#cfe1d7] bg-[#f7faf8] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#8dbda4]"
                  >
                    <option value="all">All dates</option>

                    {dates.map((date) => (
                      <option key={date} value={date}>
                        {formatDate(date)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedProvider}
                    onChange={(event) =>
                      setSelectedProvider(event.target.value)
                    }
                    className="max-w-[190px] rounded-full border border-[#cfe1d7] bg-[#f7faf8] px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#8dbda4]"
                  >
                    <option value="all">All providers</option>

                    {providers.map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Loading state */}
            {slotsLoading && (
              <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-3xl border border-[#dce8e1] bg-white p-6"
                  >
                    <div className="flex items-center gap-3">
                      <LoaderCircle className="size-5 animate-spin text-[#5f967a]" />
                      <p className="text-sm font-medium text-[#60766b]">
                        Loading appointments...
                      </p>
                    </div>

                    <div className="mt-6 h-4 w-2/3 animate-pulse rounded bg-[#eaf1ec]" />
                    <div className="mt-3 h-3 w-1/2 animate-pulse rounded bg-[#eaf1ec]" />
                    <div className="mt-7 h-10 animate-pulse rounded-full bg-[#eaf1ec]" />
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {!slotsLoading && slotsError && (
              <div className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
                <AlertCircle className="mx-auto size-9 text-red-600" />

                <h3 className="mt-4 font-semibold text-[#244438]">
                  We couldn&apos;t load appointments
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm text-[#60766b]">
                  {slotsError}
                </p>

                <Button
                  type="button"
                  onClick={loadSlots}
                  className="mt-5 rounded-full bg-[#155c46] px-6 hover:bg-[#0d4735]"
                >
                  <LoaderCircle className="mr-2 size-4" />
                  Try again
                </Button>
              </div>
            )}

            {/* Appointment cards */}
            {!slotsLoading && !slotsError && (
              <>
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredSlots.map((slot) => (
                    <Card
                      key={slot.id}
                      className={`rounded-3xl border-[#dce8e1] shadow-sm ${!slot.available
                          ? 'bg-[#fafcfb] opacity-70'
                          : 'bg-white'
                        }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle className="text-base text-[#244438]">
                              {slot.provider}
                            </CardTitle>

                            <p className="mt-1 text-sm text-[#789087]">
                              General consultation
                            </p>
                          </div>

                          <Badge
                            variant={
                              slot.available ? 'secondary' : 'outline'
                            }
                            className={
                              slot.available
                                ? 'bg-[#e2f0e8] text-[#155c46]'
                                : ''
                            }
                          >
                            {slot.available ? 'Available' : 'Booked'}
                          </Badge>
                        </div>
                      </CardHeader>

                      <CardContent>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-[#506c5e]">
                          <CalendarDays className="text-[#6ca083]" />
                          {formatDate(slot.start)}

                          <span className="text-[#b8c9bf]">•</span>

                          <Clock3 className="text-[#6ca083]" />
                          {formatTime(slot.start)} – {formatTime(slot.end)}
                        </div>

                        <Button
                          type="button"
                          className="mt-5 cursor-pointer w-full rounded-full bg-[#155c46] hover:bg-[#0d4735]"
                          disabled={!slot.available}
                          onClick={() => openBookingModal(slot)}
                        >
                          {slot.available
                            ? 'Book this slot'
                            : 'Appointment unavailable'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredSlots.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-[#cfe1d7] py-16 text-center">
                    <CalendarDays className="mx-auto text-[#8dbda4]" />

                    <h3 className="mt-4 font-semibold text-[#244438]">
                      No appointments found
                    </h3>

                    <p className="mt-1 text-sm text-[#789087]">
                      Try changing your filters to see more times.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#dce8e1] bg-[#f7faf8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-[#6c8277] md:flex-row md:items-center md:justify-between lg:px-8">
          <p className="font-medium text-[#244438]">
            CarePoint Clinic
          </p>

          <p>Accessible, convenient care for every patient.</p>

          <p>© 2026 CarePoint Clinic</p>
        </div>
      </footer>

      {/* Booking form dialog */}
      <Dialog
        open={!!selectedSlot}
        onOpenChange={(open) => {
          if (!open) closeBookingModal()
        }}
      >
        <DialogContent
          className="rounded-3xl sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="text-2xl text-[#173b2d]">
              Book your appointment
            </DialogTitle>

            <DialogDescription>
              Enter your details to reserve this appointment.
            </DialogDescription>
          </DialogHeader>

          {selectedSlot && (
            <>
              <div className="rounded-2xl bg-[#f2f8f4] p-4 text-sm">
                <p className="font-semibold text-[#244438]">
                  {selectedSlot.provider}
                </p>

                <p className="mt-1 text-[#60766b]">
                  {formatDate(selectedSlot.start)} ·{' '}
                  {formatTime(selectedSlot.start)} –{' '}
                  {formatTime(selectedSlot.end)}
                </p>
              </div>

              <form
                onSubmit={submitBooking}
                className="flex flex-col gap-4"
              >
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Full name

                  <input
                    type="text"
                    autoComplete="name"
                    value={form.name}
                    disabled={submitting}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        name: event.target.value,
                      })

                      setErrors((current) => ({
                        ...current,
                        name: '',
                      }))
                    }}
                    placeholder="Enter your full name"
                    className="h-11 rounded-xl border border-[#cfe1d7] px-3 font-normal outline-none focus:ring-2 focus:ring-[#8dbda4] disabled:bg-[#f2f8f4]"
                    aria-invalid={!!errors.name}
                  />

                  {errors.name && (
                    <span className="text-xs text-red-700">
                      {errors.name}
                    </span>
                  )}
                </label>

                <label className="flex flex-col gap-2 text-sm font-medium">
                  Email address

                  <input
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    disabled={submitting}
                    onChange={(event) => {
                      setForm({
                        ...form,
                        email: event.target.value,
                      })

                      setErrors((current) => ({
                        ...current,
                        email: '',
                      }))
                    }}
                    placeholder="you@example.com"
                    className="h-11 rounded-xl border border-[#cfe1d7] px-3 font-normal outline-none focus:ring-2 focus:ring-[#8dbda4] disabled:bg-[#f2f8f4]"
                    aria-invalid={!!errors.email}
                  />

                  {errors.email && (
                    <span className="text-xs text-red-700">
                      {errors.email}
                    </span>
                  )}
                </label>

                {errors.form && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p>{errors.form}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 cursor-pointer rounded-full bg-[#155c46] hover:bg-[#0d4735] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                      Reserving your appointment...
                    </>
                  ) : (
                    'Confirm appointment'
                  )}
                </Button>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking confirmation dialog */}
      <Dialog
        open={!!booking}
        onOpenChange={(open) => {
          if (!open) {
            setBooking(null)
            setConfirmedSlot(null)
          }
        }}
      >
        <DialogContent className="rounded-3xl sm:max-w-md">
          <div className="flex flex-col items-center text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#e2f0e8] text-[#155c46]">
              <CheckCircle2 className="size-8" />
            </span>

            <DialogTitle className="mt-5 text-2xl text-[#173b2d]">
              Your appointment is confirmed!
            </DialogTitle>

            <DialogDescription className="mt-2">
              We&apos;ve reserved your time with CarePoint Clinic.
            </DialogDescription>

            {booking && (
              <div className="mt-6 w-full rounded-2xl bg-[#f2f8f4] p-4 text-left text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[#6c8277]">
                    Booking reference
                  </span>

                  <strong className="break-all text-[#155c46]">
                    {booking.id}
                  </strong>
                </div>

                <div className="mt-4 border-t border-[#dce8e1] pt-4">
                  <p className="text-xs text-[#789087]">Patient</p>

                  <strong className="text-[#244438]">
                    {booking.name}
                  </strong>

                  <p className="mt-1 text-[#60766b]">
                    {booking.email}
                  </p>
                </div>

                {confirmedSlot && (
                  <div className="mt-4 border-t border-[#dce8e1] pt-4">
                    <p className="text-xs text-[#789087]">
                      Appointment details
                    </p>

                    <p className="mt-2 font-semibold text-[#244438]">
                      {confirmedSlot.provider}
                    </p>

                    <div className="mt-2 flex flex-col gap-2 text-[#60766b]">
                      <span className="flex items-center gap-2">
                        <CalendarDays size={16} />
                        {formatDate(confirmedSlot.start)}
                      </span>

                      <span className="flex items-center gap-2">
                        <Clock3 size={16} />
                        {formatTime(confirmedSlot.start)} –{' '}
                        {formatTime(confirmedSlot.end)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex w-full flex-col gap-3">
              <Button
                type="button"
                className="rounded-full cursor-pointer bg-[#155c46] hover:bg-[#0d4735]"
                onClick={() => {
                  window.location.href = '/my-bookings'
                }}
              >
                View my bookings
              </Button>

              <Button
                type="button"
                variant="outline"
                className="rounded-full cursor-pointer border-[#cfe1d7]"
                onClick={() => {
                  setBooking(null)
                  setConfirmedSlot(null)
                }}
              >
                Back to home
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20.8 8.9c0 5.1-8.8 10.1-8.8 10.1S3.2 14 3.2 8.9A4.7 4.7 0 0 1 12 6.4a4.7 4.7 0 0 1 8.8 2.5Z" />
    </svg>
  )
}
