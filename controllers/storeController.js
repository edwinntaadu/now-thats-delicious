const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const User = mongoose.model("User");
const multer = require("multer");
const { Jimp, JimpMime } = require("jimp");
//const uuid = require("uuid");
const { randomUUID } = require("node:crypto");

const MAX_UPLOAD_SIZE = 4 * 1024 * 1024;
const PHOTO_CONTENT_TYPE = JimpMime.jpeg;
const PHOTO_UPLOAD_FOLDER = "store-photos";

const multerOptions = {
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_SIZE,
  },
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That file type isn't allowed!" }, false);
    }
  },
};

function toBoolean(value) {
  return value === true || value === "true" || value === "on";
}

function normalizeTime(value, fallback) {
  return value || fallback;
}

function normalizeUnavailableDates(value = "") {
  return value
    .split(/\r?\n|,/)
    .map((date) => date.trim())
    .filter(Boolean)
    .map((date) => new Date(`${date}T12:00:00.000Z`))
    .filter((date) => !Number.isNaN(date.getTime()));
}

function normalizeReservationSettings(settings = {}) {
  const openingHours = Array.isArray(settings.openingHours)
    ? settings.openingHours
    : Object.values(settings.openingHours || {});

  return {
    acceptsReservations: toBoolean(settings.acceptsReservations),
    maxPartySize: Math.max(
      1,
      Math.min(100, Number(settings.maxPartySize) || 20),
    ),
    openingHours: openingHours.map((hours) => ({
      day: Number(hours.day),
      open: normalizeTime(hours.open, "17:00"),
      close: normalizeTime(hours.close, "21:00"),
      closed: toBoolean(hours.closed),
    })),
    unavailableDates: normalizeUnavailableDates(settings.unavailableDatesText),
  };
}

async function uploadPhoto(buffer) {
  const { put } = await import("@vercel/blob");
  return put(`${PHOTO_UPLOAD_FOLDER}/${randomUUID()}.jpeg`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: PHOTO_CONTENT_TYPE,
  });
}

function isBlobUrl(photo) {
  return (
    typeof photo === "string" &&
    /^https?:\/\/.+vercel-storage\.com\//i.test(photo)
  );
}

function normalizeCoordinates(coordinates = []) {
  const lng = coordinates[0];
  const lat = coordinates[1];

  if (lng === undefined || lng === "" || lat === undefined || lat === "") {
    return null;
  }

  const normalized = [Number(lng), Number(lat)];
  return normalized.every(Number.isFinite) ? normalized : null;
}

async function deletePhoto(photoPathname, photoUrl) {
  const photoToDelete =
    photoPathname || (isBlobUrl(photoUrl) ? photoUrl : null);
  if (!photoToDelete) return;

  try {
    const { del } = await import("@vercel/blob");
    await del(photoToDelete);
  } catch (error) {
    console.error("Could not delete old Blob photo", error);
  }
}

// GET home page
exports.homePage = (req, res) => {
  res.render("index");
};

// GET add store page
exports.addStore = (req, res) => {
  res.render("editStore", {
    title: "Add Store",
  });
};
// Middleware to handle photo uploads(save the photo to memory instead of saving to disk)
exports.upload = multer(multerOptions).single("photo");

// Middleware to resize the photo
exports.resize = async (req, res, next) => {
  // Check if there is no new file to resize
  if (!req.file) {
    next(); // skip to the next middleware
    return;
  }
  // Now we resize the photo
  const photo = await Jimp.read(req.file.buffer);
  await photo.resize({ w: 800 });
  const buffer = await photo.getBuffer(PHOTO_CONTENT_TYPE, { quality: 82 });
  const blob = await uploadPhoto(buffer);
  req.body.photo = blob.url;
  req.body.photoPathname = blob.pathname;
  // Once we have uploaded the photo to Blob, keep going!
  next();
};

// POST add store page
exports.createStore = async (req, res) => {
  req.body.author = req.user._id;
  req.body.reservationSettings = normalizeReservationSettings(
    req.body.reservationSettings,
  );

  const store = await new Store(req.body).save();
  req.flash(
    "success",
    `Successfully created ${store.name}. Care to leave a review?`,
  );
  res.redirect(`/stores/${store.slug}`);
};

// GET stores page
exports.getStores = async (req, res) => {
  const page = req.params.page || 1;
  const limit = 4;
  const skip = page * limit - limit;

  // 1. Query the database for a list of all stores
  const storesPromise = Store.find()
    .skip(skip)
    .limit(limit)
    .sort({ created: "desc" });

  const countPromise = Store.countDocuments();

  const [stores, count] = await Promise.all([storesPromise, countPromise]);
  const pages = Math.ceil(count / limit);
  if (!stores.length && skip) {
    req.flash(
      "info",
      `Hey! You asked for page ${page}. But that doesn't exist. So I put you on page ${pages}`,
    );
    res.redirect(`/stores/page/${pages}`);
    return;
  }

  res.render("stores", { title: "Stores", stores, page, pages, count });
};

const confirmOwner = (store, user) => {
  if (!store) {
    throw Error("No store found!");
  }
  if (!user) {
    throw Error("You must be logged in to edit a store!");
  }
  if (!store.author.equals(user._id)) {
    throw Error("You must own a store in order to edit it!");
  }
};

// GET edit store page
exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  confirmOwner(store, req.user);
  // 3. Render out the edit form so the user can update their store
  res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  const previousStore = await Store.findOne({ _id: req.params.id }).select(
    "author location photo photoPathname",
  );
  confirmOwner(previousStore, req.user);

  // Set the location data to be a point
  req.body.location = req.body.location || {};
  req.body.location.type = "Point";

  req.body.location.coordinates =
    normalizeCoordinates(req.body.location.coordinates) ||
    normalizeCoordinates(previousStore.location?.coordinates);

  if (!req.body.location.address && previousStore.location?.address) {
    req.body.location.address = previousStore.location.address;
  }

  req.body.reservationSettings = normalizeReservationSettings(
    req.body.reservationSettings,
  );
  // 1. Find and updare the store
  let store;
  try {
    store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
      returnDocument: "after", // return the new store instead of the old one
      runValidators: true, // force our model to run the validators for us
    }).exec();
  } catch (error) {
    if (req.body.photoPathname) {
      await deletePhoto(req.body.photoPathname, req.body.photo);
    }
    throw error;
  }

  if (req.body.photoPathname) {
    await deletePhoto(previousStore.photoPathname, previousStore.photo);
  }
  req.flash(
    "success",
    `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store →</a>`,
  );
  res.redirect(`/stores/${store._id}/edit`);
  // 2. Redirect them to the store and tell them it worked
};

exports.getStoreBySlug = async (req, res, next) => {
  const store = await Store.findOne({ slug: req.params.slug })
    .populate("author")
    .populate("reviews");
  if (!store) {
    return next();
  }
  res.render("store", { store, title: store.name });
};

exports.getStoresByTag = async (req, res) => {
  const tag = req.params.tag;
  const tagQuery = tag || { $exists: true };
  const tagsPromise = Store.getTagsList();
  const storesPromise = Store.find({ tags: tagQuery });
  const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);

  res.render("tag", { tags, title: "Tags", tag, stores });
};

exports.searchStores = async (req, res) => {
  const stores = await Store
    // first find stores that match
    .find(
      {
        $text: {
          $search: req.query.q,
        },
      },
      {
        score: { $meta: "textScore" },
      },
    )
    // then sort them
    .sort({
      score: { $meta: "textScore" },
    })
    // limit to only 5 results
    .limit(5);
  res.json(stores);
};

exports.mapStores = async (req, res) => {
  const coordinates = [req.query.lng, req.query.lat].map(parseFloat);
  const q = {
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates,
        },
        $maxDistance: 10000, // 10km
      },
    },
  };

  const stores = await Store.find(q)
    .select("slug name description location photo")
    .limit(10);
  res.json(stores);
};

exports.mapPage = (req, res) => {
  res.render("map", { title: "Map" });
};

exports.heartStore = async (req, res) => {
  const hearts = req.user.hearts.map((obj) => obj.toString());
  const operator = hearts.includes(req.params.id) ? "$pull" : "$addToSet";
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      [operator]: { hearts: req.params.id },
    },
    { new: true },
  );
  res.json(user);
};

exports.getHearts = async (req, res) => {
  const stores = await Store.find({
    _id: { $in: req.user.hearts },
  });
  res.render("stores", { title: "Hearted Stores", stores });
};

exports.getTopStores = async (req, res) => {
  const stores = await Store.getTopStores();
  res.render("topStores", { stores, title: "⭐️ Top Stores!" });
};
