const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: "Please enter a store name",
    trim: true,
  },

  slug: String,

  description: {
    type: String,
    trim: true,
  },

  tags: [String],
});

storeSchema.pre("save", async function () {
  if (!this.isModified("name")) {
    //next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  //next();
  // TODO make more resiliant so slugs are unique
});

module.exports = mongoose.model("Store", storeSchema);
