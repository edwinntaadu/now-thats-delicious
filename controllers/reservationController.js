const mongoose = require("mongoose");
const mail = require("../handlers/mail");

const Reservation = mongoose.model("Reservation");
const Store = mongoose.model("Store");

const DEFAULT_OPENING_HOURS = [
  { day: 0, open: "17:00", close: "21:00", closed: false },
  { day: 1, open: "17:00", close: "21:00", closed: false },
  { day: 2, open: "17:00", close: "21:00", closed: false },
  { day: 3, open: "17:00", close: "21:00", closed: false },
  { day: 4, open: "17:00", close: "21:00", closed: false },
  { day: 5, open: "17:00", close: "21:00", closed: false },
  { day: 6, open: "17:00", close: "21:00", closed: false },
];

function dateKey(date) {
  return date.toISOString().split("T")[0];
}

function isSameDate(a, b) {
  return dateKey(a) === dateKey(b);
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getOpeningHoursForDate(store, date) {
  const settings = store.reservationSettings || {};
  const openingHours =
    settings.openingHours && settings.openingHours.length
      ? settings.openingHours
      : DEFAULT_OPENING_HOURS;

  const day = date.getDay();
  return openingHours.find((hours) => Number(hours.day) === day);
}

function getAvailableTimes(store, date) {
  const settings = store.reservationSettings || {};

  if (settings.acceptsReservations === false) {
    return [];
  }

  const unavailableDates = settings.unavailableDates || [];

  if (
    unavailableDates.some((unavailableDate) =>
      isSameDate(unavailableDate, date),
    )
  ) {
    return [];
  }

  const hours = getOpeningHoursForDate(store, date);

  if (!hours || hours.closed) {
    return [];
  }

  const start = timeToMinutes(hours.open);
  const end = timeToMinutes(hours.close);
  const slots = [];

  for (let time = start; time < end; time += 30) {
    slots.push(minutesToTime(time));
  }

  return slots;
}

function validateReservationAvailability(store, date, time, partySize) {
  const settings = store.reservationSettings || {};
  const maxPartySize = settings.maxPartySize || 20;

  if (settings.acceptsReservations === false) {
    throw Error("This store is not accepting reservations right now.");
  }

  if (partySize > maxPartySize) {
    throw Error(
      `This store accepts reservations for up to ${maxPartySize} people.`,
    );
  }

  const availableTimes = getAvailableTimes(store, date);

  if (!availableTimes.includes(time)) {
    throw Error("That reservation time is not available.");
  }
}

const ACTIVE_STATUSES = ["pending", "confirmed"];

function getBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

function formatReservationDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getReservationEmailData(req, reservation) {
  return {
    reservation,
    store: reservation.store,
    reservationDate: formatReservationDate(reservation.date),
    reservationUrl: `${getBaseUrl(req)}/account/reservations`,
    ownerReservationsUrl: `${getBaseUrl(req)}/stores/${reservation.store._id}/reservations`,
    storeUrl: `${getBaseUrl(req)}/stores/${reservation.store.slug}`,
  };
}

async function sendReservationEmail(options) {
  try {
    await mail.send(options);
  } catch (error) {
    console.error("Reservation email failed:", error);
  }
}

function redirectBack(req, res, fallback = "/") {
  res.redirect(req.get("Referrer") || fallback);
}

function parseReservationDate(value) {
  if (!value) {
    throw Error("Please choose a reservation date.");
  }

  const date = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw Error("Please choose a valid reservation date.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDate = new Date(date);
  selectedDate.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    throw Error("Reservation date cannot be in the past.");
  }

  return date;
}

function parsePartySize(value) {
  const partySize = Number(value);

  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) {
    throw Error("Party size must be between 1 and 20.");
  }

  return partySize;
}

function confirmStoreOwner(store, user) {
  if (!store) {
    throw Error("Store not found.");
  }

  if (!user) {
    throw Error("You must be logged in.");
  }

  const author =
    store.author && store.author._id ? store.author._id : store.author;

  if (!author.equals(user._id)) {
    throw Error("You must own this store to manage reservations.");
  }
}

exports.createReservation = async (req, res) => {
  const store = await Store.findById(req.params.id)
    .select("name slug author reservationSettings")
    .populate("author");

  if (!store) {
    throw Error("Store not found.");
  }

  if (store.author.equals(req.user._id)) {
    req.flash("error", "You cannot reserve a table at your own store.");
    return res.redirect(`/stores/${store.slug}`);
  }

  const date = parseReservationDate(req.body.date);
  const partySize = parsePartySize(req.body.partySize);
  const time = req.body.time;

  if (!time) {
    throw Error("Please choose a reservation time.");
  }

  validateReservationAvailability(store, date, time, partySize);

  const existingReservation = await Reservation.findOne({
    store: store._id,
    user: req.user._id,
    date,
    time,
    status: { $in: ACTIVE_STATUSES },
  });

  if (existingReservation) {
    req.flash(
      "error",
      "You already have an active reservation request for this time.",
    );
    return res.redirect(`/stores/${store.slug}`);
  }

  const reservation = await new Reservation({
    store: store._id,
    user: req.user._id,
    date,
    time,
    partySize,
    note: req.body.note,
  }).save();

  await reservation.populate("user");
  reservation.store = store;

  const emailData = getReservationEmailData(req, reservation);

  await sendReservationEmail({
    user: reservation.user,
    subject: `Reservation request sent for ${store.name}`,
    filename: "reservation-request-received",
    ...emailData,
  });

  await sendReservationEmail({
    user: store.author,
    subject: `New reservation request for ${store.name}`,
    filename: "new-reservation-request",
    ...emailData,
  });

  req.flash("success", `Reservation request sent to ${store.name}.`);
  res.redirect(`/stores/${store.slug}`);
};

exports.getUserReservations = async (req, res) => {
  const reservations = await Reservation.find({ user: req.user._id }).sort({
    date: 1,
    time: 1,
  });

  res.render("accountReservations", {
    title: "My Reservations",
    reservations,
  });
};

exports.getStoreReservations = async (req, res) => {
  const store = await Store.findById(req.params.id).select("name slug author");

  confirmStoreOwner(store, req.user);

  const reservations = await Reservation.find({ store: store._id }).sort({
    date: 1,
    time: 1,
  });

  res.render("storeReservations", {
    title: `Reservations for ${store.name}`,
    store,
    reservations,
  });
};

exports.cancelReservation = async (req, res) => {
  const reservation = await Reservation.findById(req.params.id).populate({
    path: "store",
    select: "name slug author",
  });

  if (!reservation) {
    throw Error("Reservation not found.");
  }

  const isReservationOwner = reservation.user._id.equals(req.user._id);
  const storeAuthor = reservation.store.author._id || reservation.store.author;
  const isStoreOwner = storeAuthor.equals(req.user._id);

  if (!isReservationOwner && !isStoreOwner) {
    throw Error("You cannot cancel this reservation.");
  }

  if (!ACTIVE_STATUSES.includes(reservation.status)) {
    req.flash(
      "error",
      "Only pending or confirmed reservations can be cancelled.",
    );
    return redirectBack(req, res);
  }

  reservation.status = "cancelled";
  reservation.cancelledAt = new Date();
  await reservation.save();

  req.flash("success", "Reservation cancelled.");
  redirectBack(req, res);
};

async function updateReservationStatus(req, res, status) {
  const reservation = await Reservation.findById(req.params.id).populate({
    path: "store",
    select: "name slug author",
  });

  if (!reservation) {
    throw Error("Reservation not found.");
  }

  confirmStoreOwner(reservation.store, req.user);

  reservation.status = status;

  if (status === "confirmed") {
    reservation.confirmedAt = new Date();
  }

  if (req.body.ownerMessage) {
    reservation.ownerMessage = req.body.ownerMessage;
  }

  await reservation.save();

  const emailData = getReservationEmailData(req, reservation);

  await sendReservationEmail({
    user: reservation.user,
    subject: `Reservation ${status} at ${reservation.store.name}`,
    filename: "reservation-status-update",
    status,
    ...emailData,
  });

  req.flash("success", `Reservation marked as ${status}.`);
  redirectBack(req, res);
}

exports.confirmReservation = (req, res) =>
  updateReservationStatus(req, res, "confirmed");
exports.declineReservation = (req, res) =>
  updateReservationStatus(req, res, "declined");
exports.completeReservation = (req, res) =>
  updateReservationStatus(req, res, "completed");
exports.noShowReservation = (req, res) =>
  updateReservationStatus(req, res, "no-show");
