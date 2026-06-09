const passport = require("passport");

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
