/*
  This is a file of data and helper functions that we can expose and use in our templating function
*/

// FS is a built in module to node that let's us read files from the system we're running on
const fs = require("fs");

// moment.js is a handy library for displaying dates. We need this in our templates to display things like "Posted 5 minutes ago"
exports.moment = require("moment");

// Dump is a handy debugging function we can use to sort of "console.log" our data
exports.dump = (obj) => JSON.stringify(obj, null, 2);

// Making a static map is really long - this is a handy helper function to make one
exports.staticMap = ([lng, lat]) =>
  `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=14&size=800x150&key=${process.env.MAP_KEY}&markers=${lat},${lng}&scale=2`;

exports.storePhoto = (photo) => {
  if (!photo) return "/uploads/store.png";
  if (/^https?:\/\//i.test(photo)) return photo;
  return `/uploads/${photo}`;
};

// inserting an SVG
exports.icon = (name) => fs.readFileSync(`./public/images/icons/${name}.svg`);

// Some details about the site
exports.siteName = `Now That's Delicious!`;

exports.menu = [
  { slug: "/stores", title: "Stores", icon: "store" },
  { slug: "/tags", title: "Tags", icon: "tag" },
  { slug: "/top", title: "Top", icon: "top" },
  { slug: "/add", title: "Add", icon: "add" },
  { slug: "/map", title: "Map", icon: "map" },
];

exports.daysOfWeek = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

exports.defaultOpeningHours = [
  { day: 0, open: "17:00", close: "21:00", closed: false },
  { day: 1, open: "17:00", close: "21:00", closed: false },
  { day: 2, open: "17:00", close: "21:00", closed: false },
  { day: 3, open: "17:00", close: "21:00", closed: false },
  { day: 4, open: "17:00", close: "21:00", closed: false },
  { day: 5, open: "17:00", close: "21:00", closed: false },
  { day: 6, open: "17:00", close: "21:00", closed: false },
];

exports.reservationSettings = (store = {}) => {
  const settings = store.reservationSettings || {};
  const openingHours =
    settings.openingHours && settings.openingHours.length
      ? settings.openingHours
      : exports.defaultOpeningHours;

  return {
    acceptsReservations: settings.acceptsReservations !== false,
    maxPartySize: settings.maxPartySize || 20,
    openingHours,
    unavailableDates: settings.unavailableDates || [],
  };
};
