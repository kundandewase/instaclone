var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var expressSession = require('express-session');
const MongoStoreModule = require('connect-mongo');
require('dotenv').config();

var webRouter = require('./routes/web');
var apiRouter = require('./routes/api');

const passport = require('passport');
const LocalStrategy = require('passport-local');

var app = express();
const User = require('./models/users'); 
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Required for secure cookies when running behind Render/NGINX proxy.
  app.set('trust proxy', 1);
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const sessionConfig = {
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  secret: process.env.SESSION_SECRET || 'hey hey hey',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction ? 'auto' : false
  }
};

if (process.env.MONGODB_URI) {
  const MongoStore = MongoStoreModule && MongoStoreModule.create
    ? MongoStoreModule
    : MongoStoreModule.default;

  if (MongoStore && MongoStore.create) {
    sessionConfig.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600
    });
  }
}

app.use(expressSession(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', webRouter);
app.use('/api', apiRouter);


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;


