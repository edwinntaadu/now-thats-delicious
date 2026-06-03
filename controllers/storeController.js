const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const multer = require("multer");
const { Jimp } = require("jimp");
const uuid = require("uuid");

const multerOptions = {
  storage: multer.memoryStorage(),
  fileFilter(req, file, next) {
    const isPhoto = file.mimetype.startsWith("image/");
    if (isPhoto) {
      next(null, true);
    } else {
      next({ message: "That file type isn't allowed!" }, false);
    }
  },
};

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
  const extension = req.file.mimetype.split("/")[1];
  req.body.photo = `${uuid.v4()}.${extension}`; // generate a unique filename for the photo
  // Now we resize the photo
  const photo = await Jimp.read(req.file.buffer);
  await photo.resize({ w: 800 });
  await photo.write(`./public/uploads/${req.body.photo}`);
  // Once we have written the photo to our filesystem, keep going!
  next();
};

// POST add store page
exports.createStore = async (req, res) => {
  const store = await new Store(req.body).save();
  req.flash(
    "success",
    `Successfully created ${store.name}. Care to leave a review?`,
  );
  res.redirect(`/stores/${store.slug}`);
};

// GET stores page
exports.getStores = async (req, res) => {
  // 1. Query the database for a list of all stores
  const stores = await Store.find();
  console.log(stores);
  res.render("stores", { title: "Stores", stores });
};

// GET edit store page
exports.editStore = async (req, res) => {
  // 1. Find the store given the ID
  const store = await Store.findOne({ _id: req.params.id });
  // 2. Confirm they are the owner of the store
  // TODO
  // 3. Render out the edit form so the user can update their store
  res.render("editStore", { title: `Edit ${store.name}`, store });
};

exports.updateStore = async (req, res) => {
  // Set the location data to be a point
  req.body.location.type = "Point";
  // 1. Find and updare the store
  const store = await Store.findOneAndUpdate({ _id: req.params.id }, req.body, {
    new: true, // return the new store instead of the old one
    runValidators: true, // force our model to run the validators for us
  }).exec();
  req.flash(
    "success",
    `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store →</a>`,
  );
  res.redirect(`/stores/${store._id}/edit`);
  // 2. Redirect them to the store and tell them it worked
};
