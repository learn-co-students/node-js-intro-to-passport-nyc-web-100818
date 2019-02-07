const _ = require("lodash");
const path = require("path");
const bodyParser = require("body-parser");
const express = require("express");
const knex = require("knex");
const handlebars = require("express-handlebars");

const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const cookieParser = require("cookie-parser");
const flash = require("connect-flash");

const ENV = process.env.NODE_ENV || "development";
const config = require("../knexfile");
const db = knex(config[ENV]);

// Initialize Express.
const app = express();
app.use(flash());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: "our secret string" }));
app.use(cookieParser());
app.use(passport.initialize()); // <-- Register the Passport middleware.

// Configure handlebars templates.
app.engine(
  "handlebars",
  handlebars({
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "/views/layouts")
  })
);
app.set("views", path.join(__dirname, "/views"));
app.set("view engine", "handlebars");

// Configure & Initialize Bookshelf & Knex.
console.log(`Running in environment: ${ENV}`);

// ***** Models ***** //

const Comment = require("./models/comment");
const Post = require("./models/post");
const User = require("./models/user");

// ***** Passport ***** //

passport.use(
  new LocalStrategy((username, password, done) => {
    User.forge({ username: username })
      .fetch()
      .then(usr => {
        if (!usr) {
          return done(null, false);
        }
        usr.validatePassword(password).then(valid => {
          if (!valid) {
            return done(null, false);
          }
          return done(null, usr);
        });
      })
      .catch(err => {
        return done(err);
      });
  })
);

// used to store user info in session
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(user, done) {
  User.forge({ id: user })
    .fetch()
    .then(usr => {
      done(null, usr);
    })
    .catch(err => {
      done(err);
    });
});

// auth middleware
const isAuthenticated = (req, res, done) => {
  if (req.session && req.session.passport) {
    return done();
  } else {
    res.redirect("/login");
  }
};

// ***** Server ***** //
app.get("/login", (req, res) => {
  res.render("login", { message: req.flash("error") });
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true
  }),
  function(req, res) {
    res.redirect("/posts");
  }
);

app.get("/user/:id", isAuthenticated, (req, res) => {
  User.forge({ id: req.params.id })
    .fetch()
    .then(usr => {
      if (_.isEmpty(usr)) return res.sendStatus(404);
      res.send(usr);
    })
    .catch(error => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post("/user", isAuthenticated, (req, res) => {
  if (_.isEmpty(req.body)) return res.sendStatus(400);
  User.forge(req.body)
    .save()
    .then(usr => {
      res.send({ id: usr.id });
    })
    .catch(error => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.get("/posts", isAuthenticated, (req, res) => {
  Post.collection()
    .fetch()
    .then(posts => {
      res.send(posts);
    })
    .catch(error => {
      res.sendStatus(500);
    });
});

app.get("/post/:id", isAuthenticated, (req, res) => {
  Post.forge({ id: req.params.id })
    .fetch({ withRelated: ["author", "comments"] })
    .then(post => {
      if (_.isEmpty(post)) return res.sendStatus(404);
      res.send(post);
    })
    .catch(error => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post("/post", isAuthenticated, (req, res) => {
  if (_.isEmpty(req.body)) return res.sendStatus(400);
  Post.forge(req.body)
    .save()
    .then(post => {
      res.send({ id: post.id });
    })
    .catch(error => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post("/comment", isAuthenticated, (req, res) => {
  if (_.isEmpty(req.body)) return res.sendStatus(400);
  Comment.forge(req.body)
    .save()
    .then(comment => {
      res.send({ id: comment.id });
    })
    .catch(error => {
      console.error(error);
      res.sendStatus(500);
    });
});

// Exports for Server Hoisting.

const listen = port => {
  return new Promise((resolve, reject) => {
    return resolve(app.listen(port));
  });
};

exports.up = justBackend => {
  return db.migrate
    .latest([ENV])
    .then(() => {
      return db.migrate.currentVersion();
    })
    .then(val => {
      console.log("Done running latest migration:", val);
      return listen(3000);
    })
    .then(server => {
      console.log("Listening on port 3000...");
      return server;
    });
};
