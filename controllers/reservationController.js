const mongoose = require("mongoose");

const Reservation = mongoose.model("Reservation");
const Store = mongoose.model("Store");

const ACTIVE_STATUSES = ["pending", "confirmed"];

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
  const store = await Store.findById(req.params.id).select("name slug author");

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

  await new Reservation({
    store: store._id,
    user: req.user._id,
    date,
    time,
    partySize,
    note: req.body.note,
  }).save();

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
