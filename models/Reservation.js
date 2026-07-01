const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const reservationSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.ObjectId,
      ref: "Store",
      required: "You must supply a store!",
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: "You must supply a user!",
    },
    date: {
      type: Date,
      required: "Please choose a reservation date.",
    },
    time: {
      type: String,
      required: "Please choose a reservation time.",
    },
    partySize: {
      type: Number,
      min: [1, "Party size must be at least 1."],
      max: [20, "Please contact the restaurant for parties larger than 20."],
      required: "Please enter your party size.",
    },
    note: {
      type: String,
      trim: true,
      maxlength: [
        500,
        "Reservation notes cannot be longer than 500 characters.",
      ],
    },
    ownerMessage: {
      type: String,
      trim: true,
      maxlength: [500, "Owner messages cannot be longer than 500 characters."],
    },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "declined",
        "cancelled",
        "completed",
        "no-show",
      ],
      default: "pending",
    },
    confirmedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: {
      createdAt: "created",
      updatedAt: "updated",
    },
  },
);

reservationSchema.index({ user: 1, date: -1 });
reservationSchema.index({ store: 1, date: 1, time: 1 });
reservationSchema.index({ store: 1, status: 1 });

function autopopulate() {
  this.populate("store").populate("user");
}

reservationSchema.pre("find", autopopulate);
reservationSchema.pre("findOne", autopopulate);

module.exports = mongoose.model("Reservation", reservationSchema);
