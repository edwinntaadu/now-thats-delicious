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

  photo: String,

  tags: [String],
  created: {
    type: Date,
    default: Date.now,
  },
  location: {
    type: {
      type: String,
      default: "Point",
    },
    coordinates: [
      {
        type: Number,
        required: "You must supply coordinates!",
      },
    ],
    address: {
      type: String,
      required: "You must supply an address!",
    },
  },
});

storeSchema.pre("save", async function () {
  if (!this.isModified("name")) {
    //next(); // skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  // find other stores that have a slug of abc, abc-1, abc-2
  const slugRegEx = new RegExp(`^(${this.slug})(-[0-9]*$)?$`, "i");
  const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }

  //next();
  // TODO make more resiliant so slugs are unique
});

module.exports = mongoose.model("Store", storeSchema);
