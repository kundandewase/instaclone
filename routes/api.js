const express = require('express');

const router = express.Router();

const userModel = require('../models/users');
const postModel = require('./posts');
const Message = require('../models/message');
const { isLoggedIn } = require('../middleware/auth');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.get('/posts/:postid/like', isLoggedIn, async function (req, res) {
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

router.get('/posts/:postid/save', isLoggedIn, async function (req, res) {
  const user = await userModel.findOne({ username: req.session.passport.user });

  if (user.saved.indexOf(req.params.postid) === -1) {
    user.saved.push(req.params.postid);
  } else {
    const index = user.saved.indexOf(req.params.postid);
    user.saved.splice(index, 1);
  }

  await user.save();
  res.json(user);
});

router.get('/users/search/:user', isLoggedIn, async function (req, res) {
  const searchTerm = `^${req.params.user}`;
  const regex = new RegExp(searchTerm);

  const users = await userModel.find({ username: { $regex: regex } });
  res.json(users);
});

router.post('/messages/send', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;
    const receiver = (req.body.receiver || '').trim();
    const text = (req.body.text || '').trim();

    if (!receiver || !text) {
      return res.status(400).send('Receiver and message are required');
    }

    const receiverDoc = await userModel.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(receiver)}$`, 'i') },
    }).select('username');

    if (!receiverDoc) {
      return res.status(404).send('Receiver not found');
    }

    const normalizedReceiver = receiverDoc.username;

    await Message.create({ sender: currentUser, receiver: normalizedReceiver, text });

    if (req.get('X-Requested-With') === 'XMLHttpRequest' || req.accepts(['json', 'html']) === 'json') {
      return res.json({ ok: true, sender: currentUser, receiver: normalizedReceiver, text });
    }

    return res.redirect(`/chat?u=${encodeURIComponent(normalizedReceiver)}`);
  } catch (err) {
    console.log(err);
    if (req.get('X-Requested-With') === 'XMLHttpRequest' || req.accepts(['json', 'html']) === 'json') {
      return res.status(500).json({ error: 'Error sending message' });
    }
    return res.send('Error sending message');
  }
});

router.get('/chat/conversations', isLoggedIn, async (req, res) => {
  try {
    const currentUser = req.session.passport.user;

    const messageHistory = await Message.find({
      $or: [{ sender: currentUser }, { receiver: currentUser }],
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
      username: { $regex: new RegExp(`^${escapeRegex(requestedUser)}$`, 'i') },
    }).select('username');

    if (!otherUserDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otherUser = otherUserDoc.username;

    const messages = await Message.find({
      $or: [
        { sender: currentUser, receiver: otherUser },
        { sender: otherUser, receiver: currentUser },
      ],
    }).sort({ createdAt: 1 });

    return res.json({ messages, currentUser, otherUser });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: 'Error loading chat' });
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
      username: { $regex: new RegExp(`^${escapeRegex(requestedUser)}$`, 'i') },
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

    return res.json({ message });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: 'Error sending chat message' });
  }
});

module.exports = router;
