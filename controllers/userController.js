const mongoose = require("mongoose");
const User = mongoose.model("User");
const promisify = require("es6-promisify");
const { body, validationResult } = require("express-validator");

exports.loginForm = (req, res) => {
  res.render("login", {
    title: "Login",
  });
};

exports.registerForm = (req, res) => {
  res.render("register", {
    title: "Register",
  });
};

// middleware
exports.validateRegister = [
  body("name").trim().notEmpty().withMessage("You must supply a name!"),

  body("email")
    .isEmail()
    .withMessage("That Email is not valid!")
    .normalizeEmail({
      gmail_remove_dots: false,
      gmail_remove_subaddress: false,
    }),

  body("password").notEmpty().withMessage("Password Cannot be Blank!"),

  body("password-confirm")
    .notEmpty()
    .withMessage("Confirmed Password cannot be blank!")
    .custom((value, { req }) => value === req.body.password)
    .withMessage("Oops! Your passwords do not match"),

  (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      req.flash(
        "error",
        errors.array().map((err) => err.msg),
      );

      return res.render("register", {
        title: "Register",
        body: req.body,
        flashes: req.flash(),
      });
    }

    next(); // there were no errors!
  },
];

exports.register = async (req, res, next) => {
  const user = new User({ email: req.body.email, name: req.body.name });
  await User.register(user, req.body.password);
  next(); // pass to authController.login
};

exports.account = (req, res) => {
  res.render("account", {
    title: "Edit Your Account",
  });
};

exports.updateAccount = async (req, res) => {
  const updates = {
    name: req.body.name,
    email: req.body.email,
  };

  const user = await User.findOneAndUpdate(
    { _id: req.user._id },
    { $set: updates },
    { new: true, runValidators: true, context: "query" },
  );

  req.flash("success", "Updated the profile!");
  res.redirect("/account");
};
