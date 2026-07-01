const express = require("express");
//const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
// const expressValidator = require("express-validator");
const MongoStore = require("connect-mongo").default;
const helpers = require("./helpers");
errorHandlers = require("./handlers/errorHandlers");

const connectDB = require("./config/db");

require("./models/Store");
require("./models/User");
require("./models/Review");
require("./models/Reservation");

require("./handlers/passport");
const routes = require("./routes/index");
const { error } = require("console");

connectDB();

// create our Express app
const app = express();

// view engine setup
app.set("view engine", "pug");
app.set("views", path.join(__dirname, "views"));

// serves up static files from the public folder. Anything in public/ will just be served up as the file it is
app.use(express.static(path.join(__dirname, "public")));

//app.use(cors());

// Takes the raw requests and turns them into usable properties on req.body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Exposes a bunch of methods for validating data. Used heavily on userController.validateRegister
// app.use(expressValidator());

// Sessions allow us to store data on visitors from request to request
// This keeps users logged in and allows us to send flash messages
app.use(
  session({
    secret: process.env.SECRET,
    key: process.env.KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.DATABASE,
    }),
  }),
);

// Passport JS is what we use to handle our logins
app.use(passport.initialize());
app.use(passport.session());

// The flash middleware let's us use req.flash('error', 'Sh!t!'), which will then pass that message to the next page the user requests
app.use(flash());

// pass variables to our templates + all requests
app.use((req, res, next) => {
  res.locals.h = helpers;
  res.locals.flashes = req.flash();
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
  //console.log(req.flash());
});

// After allllll that above middleware, we finally handle our own routes!
app.use("/", routes);

// If that above routes didnt work, we 404 them and forward to error handler
app.use(errorHandlers.notFound);

// One of our error handlers will see if these errors are just validation errors
app.use(errorHandlers.flashValidationErrors);

// production error handler
app.use(errorHandlers.productionErrors);

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
