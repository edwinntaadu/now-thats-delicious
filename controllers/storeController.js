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
  const store = new Store(req.body);
  await store.save();
  //console.log("It worked!");
  res.redirect("/");
};
