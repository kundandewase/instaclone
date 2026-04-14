const express = require('express');
const passport = require('passport');

const router = express.Router();

const userModel = require('../models/users');
const postModel = require('./posts');
const storyModel = require('./story');
const upload = require('./multer');
const utils = require('../utils/utils');
const User = require('../models/users');
const { isLoggedIn } = require('../middleware/auth');

router.get('/', function (req, res) {
  res.render('index', { footer: false });
});

router.get('/chat-search', isLoggedIn, (req, res) => {
  res.render('chat-search');
});

router.post('/chat', isLoggedIn, async (req, res) => {
  try {
    const { username } = req.body;
    const user = await User.findOne({ username });

    if (!user) {
      return res.send('User not found');
    }

    return res.redirect(`/chat?u=${encodeURIComponent(user.username)}`);
  } catch (err) {
    console.log(err);
    return res.send('Error searching user');
  }
});

router.get('/login', function (req, res) {
  res.render('login', {
    footer: false,
    loginError: req.query.error === '1',
    attemptedUsername: (req.query.u || '').trim(),
  });
});

router.get('/feed', isLoggedIn, async function (req, res) {
  const user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate('posts');

  const stories = await storyModel
    .find({ user: { $ne: user._id } })
    .populate('user');

  const uniq = {};
  const filtered = stories.filter((item) => {
    if (!uniq[item.user.id]) {
      uniq[item.user.id] = ' ';
      return true;
    }
    return false;
  });

  const posts = await postModel.find().populate('user');

  res.render('feed', {
    footer: true,
    user,
    posts,
    stories: filtered,
    dater: utils.formatRelativeTime,
  });
});

router.get('/profile', isLoggedIn, async function (req, res) {
  const user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate('posts')
    .populate('saved');

  res.render('profile', { footer: true, user });
});

router.get('/profile/:user', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });

  if (user.username === req.params.user) {
    return res.redirect('/profile');
  }

  const userprofile = await userModel
    .findOne({ username: req.params.user })
    .populate('posts');

  return res.render('userprofile', { footer: true, userprofile, user });
});

router.get('/follow/:userid', isLoggedIn, async function (req, res) {
  const followKarneWaala = await userModel.findOne({
    username: req.session.passport.user,
  });

  const followHoneWaala = await userModel.findOne({ _id: req.params.userid });

  if (followKarneWaala.following.indexOf(followHoneWaala._id) !== -1) {
    const index = followKarneWaala.following.indexOf(followHoneWaala._id);
    followKarneWaala.following.splice(index, 1);

    const index2 = followHoneWaala.followers.indexOf(followKarneWaala._id);
    followHoneWaala.followers.splice(index2, 1);
  } else {
    followHoneWaala.followers.push(followKarneWaala._id);
    followKarneWaala.following.push(followHoneWaala._id);
  }

  await followHoneWaala.save();
  await followKarneWaala.save();

  res.redirect('back');
});

router.get('/search', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render('search', { footer: true, user });
});

router.get('/edit', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render('edit', { footer: true, user });
});

router.get('/upload', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render('upload', { footer: true, user });
});

router.post('/update', isLoggedIn, async function (req, res) {
  const user = await userModel.findOneAndUpdate(
    { username: req.session.passport.user },
    { username: req.body.username, name: req.body.name, bio: req.body.bio },
    { new: true }
  );

  req.login(user, function (err) {
    if (err) throw err;
    res.redirect('/profile');
  });
});

router.post('/post', isLoggedIn, upload.single('image'), async function (req, res) {
  const user = await userModel.findOne({
    username: req.session.passport.user,
  });

  if (req.body.category === 'post') {
    const post = await postModel.create({
      user: user._id,
      caption: req.body.caption,
      picture: req.file.filename,
    });
    user.posts.push(post._id);
  } else if (req.body.category === 'story') {
    const story = await storyModel.create({
      story: req.file.filename,
      user: user._id,
    });
    user.stories.push(story._id);
  } else {
    return res.send('tez mat chalo');
  }

  await user.save();
  return res.redirect('/feed');
});

router.post('/upload', isLoggedIn, upload.single('image'), async function (req, res) {
  const user = await userModel.findOne({
    username: req.session.passport.user,
  });
  user.picture = req.file.filename;
  await user.save();
  res.redirect('/edit');
});

router.post('/register', function (req, res, next) {
  const user = new userModel({
    username: req.body.username,
    email: req.body.email,
    name: req.body.name,
  });

  userModel.register(user, req.body.password).then(function () {
    passport.authenticate('local')(req, res, function () {
      res.redirect('/profile');
    });
  }).catch(next);
});

router.post('/login', function (req, res, next) {
  const attempted = (req.body.username || '').trim();

  const runAuthentication = () => {
    passport.authenticate('local', function (err, user) {
      if (err) {
        return next(err);
      }

      if (!user) {
        const suffix = attempted ? `&u=${encodeURIComponent(attempted)}` : '';
        return res.redirect(`/login?error=1${suffix}`);
      }

      return req.logIn(user, function (loginErr) {
        if (loginErr) {
          return next(loginErr);
        }

        return res.redirect('/feed');
      });
    })(req, res, next);
  };

  if (!req.isAuthenticated()) {
    return runAuthentication();
  }

  // Replace existing logged-in user before authenticating a different account.
  return req.logout(function (logoutErr) {
    if (logoutErr) {
      return next(logoutErr);
    }

    return req.session.regenerate(function (sessionErr) {
      if (sessionErr) {
        return next(sessionErr);
      }

      return runAuthentication();
    });
  });
});

router.get('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    return res.redirect('/login');
  });
});

router.get('/notifications', (req, res) => {
  const notifications = [
    'Someone liked your post ❤️',
    'New follower 🎉',
    'New message received 💬',
  ];

  res.render('notifications', { notifications });
});

router.get('/messages', isLoggedIn, async (req, res) => {
  try {
    const target = req.query.u ? `/chat?u=${encodeURIComponent(req.query.u)}` : '/chat';
    res.redirect(target);
  } catch (err) {
    console.log(err);
    res.send('Error loading messages');
  }
});

router.get('/chat', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });

  res.render('chat', { user, initialChatWith: req.query.u || '' });
});

module.exports = router;
