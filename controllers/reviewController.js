const mongoose = require("mongoose");
const Review = mongoose.model("Review");
const Store = mongoose.model("Store");

exports.addReview = async (req, res) => {
  req.body.author = req.user._id;
  req.body.store = req.params.id;

  await new Review(req.body).save();

  const store = await Store.findById(req.params.id);

  req.flash("success", "Review Saved!");
  res.redirect(`/stores/${store.slug}`);
};
