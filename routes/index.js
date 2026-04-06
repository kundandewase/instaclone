var express = require("express");
var router = express.Router();
const passport = require("passport");
const localStrategy = require("passport-local");
const userModel = require("../models/users");
const postModel = require("./posts");
const storyModel = require("./story");
passport.use(new localStrategy(userModel.authenticate()));

const upload = require("./multer");
const utils = require("../utils/utils");
const Message = require('../models/message');
const User = require('../models/users'); // already exists in your project

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}


// GET
router.get("/", function (req, res) {
  res.render("index", { footer: false });
});

router.get('/chat-search', isLoggedIn, (req, res) => {
  res.render('chat-search');
});

router.post('/chat', isLoggedIn, async (req, res) => {
  try {
    const { username } = req.body;

    console.log(username); // debug

    const user = await User.findOne({ username });

    if (!user) {
      return res.send("User not found");
    }

    res.redirect(`/chat/${user.username}`);

  } catch (err) {
    console.log(err);
    res.send("Error searching user");
  }
});

router.get("/login", function (req, res) {
  res.render("login", { footer: false });
});

router.get("/like/:postid", async function (req, res) {
  const post = await postModel.findOne({ _id: req.params.postid });
  const user = await userModel.findOne({ username: req.session.passport.user });
  if (post.like.indexOf(user._id) === -1) {
    post.like.push(user._id);
  } else {
    post.like.splice(post.like.indexOf(user._id), 1);
  }
  await post.save();
  res.json(post);
});

router.get("/feed", isLoggedIn, async function (req, res) {
  let user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts");

  let stories = await storyModel.find({ user: { $ne: user._id } })
  .populate("user");

  var uniq = {};
  var filtered = stories.filter(item => {
    if(!uniq[item.user.id]){
      uniq[item.user.id] = " ";
      return true;
    }
    else return false;
  })

  let posts = await postModel.find().populate("user");

  res.render("feed", {
    footer: true,
    user,
    posts,
    stories: filtered,
    dater: utils.formatRelativeTime,
  });
});

router.get("/profile", isLoggedIn, async function (req, res) {
  let user = await userModel
    .findOne({ username: req.session.passport.user })
    .populate("posts")
    .populate("saved");
  console.log(user);

  res.render("profile", { footer: true, user });
});

router.get("/profile/:user", isLoggedIn, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });

  if (user.username === req.params.user) {
    res.redirect("/profile");
  }

  let userprofile = await userModel
    .findOne({ username: req.params.user })
    .populate("posts");

  res.render("userprofile", { footer: true, userprofile, user });
});

router.get("/follow/:userid", isLoggedIn, async function (req, res) {
  let followKarneWaala = await userModel.findOne({
    username: req.session.passport.user,
  });

  let followHoneWaala = await userModel.findOne({ _id: req.params.userid });

  if (followKarneWaala.following.indexOf(followHoneWaala._id) !== -1) {
    let index = followKarneWaala.following.indexOf(followHoneWaala._id);
    followKarneWaala.following.splice(index, 1);

    let index2 = followHoneWaala.followers.indexOf(followKarneWaala._id);
    followHoneWaala.followers.splice(index2, 1);
  } else {
    followHoneWaala.followers.push(followKarneWaala._id);
    followKarneWaala.following.push(followHoneWaala._id);
  }

  await followHoneWaala.save();
  await followKarneWaala.save();

  res.redirect("back");
});

router.get("/search", isLoggedIn, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });
  res.render("search", { footer: true, user });
});

router.get("/save/:postid", isLoggedIn, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });

  if (user.saved.indexOf(req.params.postid) === -1) {
    user.saved.push(req.params.postid);
  } else {
    var index = user.saved.indexOf(req.params.postid);
    user.saved.splice(index, 1);
  }
  await user.save();
  res.json(user);
});

router.get("/search/:user", isLoggedIn, async function (req, res) {
  const searchTerm = `^${req.params.user}`;
  const regex = new RegExp(searchTerm);

  let users = await userModel.find({ username: { $regex: regex } });

  res.json(users);
});

router.get("/edit", isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });
  res.render("edit", { footer: true, user });
});

router.get("/upload", isLoggedIn, async function (req, res) {
  let user = await userModel.findOne({ username: req.session.passport.user });
  res.render("upload", { footer: true, user });
});

router.post("/update", isLoggedIn, async function (req, res) {
  const user = await userModel.findOneAndUpdate(
    { username: req.session.passport.user },
    { username: req.body.username, name: req.body.name, bio: req.body.bio },
    { new: true }
  );
  req.login(user, function (err) {
    if (err) throw err;
    res.redirect("/profile");
  });
});

router.post(
  "/post",
  isLoggedIn,
  upload.single("image"),
  async function (req, res) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });

    if (req.body.category === "post") {
      const post = await postModel.create({
        user: user._id,
        caption: req.body.caption,
        picture: req.file.filename,
      });
      user.posts.push(post._id);
    } else if (req.body.category === "story") {
      let story = await storyModel.create({
        story: req.file.filename,
        user: user._id,
      });
      user.stories.push(story._id);
    } else {
      res.send("tez mat chalo");
    }

    await user.save();
    res.redirect("/feed");
  }
);

router.post(
  "/upload",
  isLoggedIn,
  upload.single("image"),
  async function (req, res) {
    const user = await userModel.findOne({
      username: req.session.passport.user,
    });
    user.picture = req.file.filename;
    await user.save();
    res.redirect("/edit");
  }
);

// POST

router.post("/register", function (req, res) {
  const user = new userModel({
    username: req.body.username,
    email: req.body.email,
    name: req.body.name,
  });

  userModel.register(user, req.body.password).then(function (registereduser) {
    passport.authenticate("local")(req, res, function () {
      res.redirect("/profile");
    });
  });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/feed",
    failureRedirect: "/login",
  }),
  function (req, res) {}
);

router.get("/logout", function (req, res) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/login");
  });
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) 
    return next();
  res.redirect("/login");

}

router.get('/notifications', (req, res) => {
  const notifications = [
    "Someone liked your post ❤️",
    "New follower 🎉",
    "New message received 💬"
  ];

  res.render('notifications', { notifications });
});


router.get('/messages', isLoggedIn, async (req, res) => {
  try {
    const target = req.query.u ? `/chat?u=${encodeURIComponent(req.query.u)}` : '/chat';
    res.redirect(target);
  } catch (err) {
    console.log(err);
    res.send("Error loading messages");
  }
});


router.post('/send-message', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;
    const receiver = (req.body.receiver || '').trim();
    const text = (req.body.text || '').trim();

    if (!receiver || !text) {
      return res.status(400).send("Receiver and message are required");
    }

    const receiverDoc = await userModel.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(receiver)}$`, 'i') }
    }).select('username');

    if (!receiverDoc) {
      return res.status(404).send("Receiver not found");
    }

    const normalizedReceiver = receiverDoc.username;

    await Message.create({ sender: currentUser, receiver: normalizedReceiver, text });

    if (req.get('X-Requested-With') === 'XMLHttpRequest' || req.accepts(['json', 'html']) === 'json') {
      return res.json({ ok: true, sender: currentUser, receiver: normalizedReceiver, text });
    }

    res.redirect(`/chat?u=${encodeURIComponent(normalizedReceiver)}`);
  } catch (err) {
    console.log(err);
    if (req.get('X-Requested-With') === 'XMLHttpRequest' || req.accepts(['json', 'html']) === 'json') {
      return res.status(500).json({ error: 'Error sending message' });
    }
    res.send("Error sending message");
  }
});


router.get('/chat', isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ username: req.session.passport.user });

  res.render('chat', { user, initialChatWith: req.query.u || '' });
});


router.get('/chat/conversations', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;

    const messageHistory = await Message.find({
      $or: [{ sender: currentUser }, { receiver: currentUser }]
    })
      .sort({ createdAt: -1 })
      .select('sender receiver text createdAt');

    const seen = new Set();
    const latestByUser = [];

    for (const msg of messageHistory) {
      const otherUsername = msg.sender === currentUser ? msg.receiver : msg.sender;

      if (!seen.has(otherUsername)) {
        seen.add(otherUsername);
        latestByUser.push({
          username: otherUsername,
          text: msg.text,
          createdAt: msg.createdAt,
        });
      }
    }

    const usernames = latestByUser.map((item) => item.username);
    const users = await userModel
      .find({ username: { $in: usernames } })
      .select('username name picture');

    const userMap = {};
    users.forEach((usr) => {
      userMap[usr.username] = usr;
    });

    const conversations = latestByUser
      .filter((item) => !!userMap[item.username])
      .map((item) => ({
        username: item.username,
        name: userMap[item.username].name || item.username,
        picture: userMap[item.username].picture || 'def.png',
        lastText: item.text,
        lastAt: item.createdAt,
      }));

    res.json({ conversations });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Error loading conversations' });
  }
});


router.get('/chat/:username', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;
    const requestedUser = (req.params.username || '').trim();

    const otherUserDoc = await userModel.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(requestedUser)}$`, 'i') }
    }).select('username');

    if (!otherUserDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otherUser = otherUserDoc.username;

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser, receiver: currentUser }
      ]
    }).sort({ createdAt: 1 });

    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.redirect('/chat');
    }

    res.json({ messages, currentUser, otherUser });

  } catch (err) {
    console.log(err);
    res.send("Error loading chat");
  }
});


router.post('/chat/:username', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;
    const requestedUser = (req.params.username || '').trim();
    const text = (req.body.text || '').trim();

    if (!text) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    const otherUserDoc = await userModel.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(requestedUser)}$`, 'i') }
    }).select('username');

    if (!otherUserDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otherUser = otherUserDoc.username;

    const message = await Message.create({
      sender: currentUser,
      receiver: otherUser,
      text,
    });

    if (req.accepts('html')) {
      return res.redirect(`/chat?u=${encodeURIComponent(otherUser)}`);
    }

    res.json({ message });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Error sending chat message' });
  }
});

module.exports = router;
