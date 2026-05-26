const mongoose = require("mongoose");
const Store = mongoose.model("Store");

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

// POST add store page
exports.createStore = async (req, res) => {
  const store = await new Store(req.body).save();
  req.flash(
    "success",
    `Successfully created ${store.name}. Care to leave a review?`,
  );
  res.redirect("/stores");
};

// GET stores page
exports.getStores = async (req, res) => {
  // 1. Query the database for a list of all stores
  const stores = await Store.find();
  console.log(stores);
  res.render("stores", { title: "Stores", stores });
};
