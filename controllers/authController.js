const passport = require("passport");
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = mongoose.model("User");
const mail = require("../handlers/mail");

exports.login = (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) return next(err);

    if (!user) {
      req.flash("error", "Failed Login!");
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) return next(err);

      req.flash("success", "You are now logged in!");
      return res.redirect("/");
    });
  })(req, res, next);
};

exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    req.flash("success", "You are now logged out! 👋🏼");
    res.redirect("/");
  });
};

// Middleware to check if the user is logged in before allowing them to access certain routes
exports.isLoggedIn = (req, res, next) => {
  // first check if the user is authenticated
  if (req.isAuthenticated()) {
    return next(); // carry on! They are logged in!
  }
  req.flash("error", "Oops, you must be logged in to do that!");
  res.redirect("/login");
};

exports.forgot = async (req, res) => {
  // 1. Check if a user with the email exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("error", "No account with that email exists");
    return res.redirect("/login");
  }
  // 2. Set reset tokens and expiry on their account
  user.resetPasswordToken = crypto.randomBytes(20).toString("hex");
  user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
  await user.save();
  // 3. Send them an email with the token
  const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
  // TODO: send an actual email
  await mail.send({
    user: user,
    subject: "Password Reset",
    resetURL: resetURL,
    filename: "password-reset",
  });
  req.flash("success", `You have been emailed a password reset link.`);
  // 4. Redirect to login page
  res.redirect("/login");
};

exports.reset = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });
  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }
  // If there is a user, show the reset password form
  res.render("reset", {
    title: "Reset your password",
    token: req.params.token,
  });
};

exports.confirmedPasswords = (req, res, next) => {
  if (req.body.password === req.body["password-confirm"]) {
    next(); // Keepit going!
    return;
  }
  req.flash("error", "Passwords do not match!");
  res.redirect(`/account/reset/${req.params.token}`);
};

exports.update = async (req, res, next) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    req.flash("error", "Password reset is invalid or has expired");
    return res.redirect("/login");
  }

  try {
    await user.setPassword(req.body.password);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    const updatedUser = await user.save();

    req.login(updatedUser, (err) => {
      if (err) return next(err);

      req.flash(
        "success",
        "💃🏽 Nice! Your password has been reset! You are now logged in!",
      );

      return res.redirect("/");
    });
  } catch (err) {
    return next(err);
  }
};
