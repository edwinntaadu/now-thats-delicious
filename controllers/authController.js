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
