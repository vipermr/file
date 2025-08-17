
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(process.env.MONGODB_URI);

const CommentSchema = new mongoose.Schema({
  user: String,
  text: String,
  likes: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  likes: { type: Number, default: 0 },
  user: String,
  text: String,
  media: String,
  fileType: String,
  createdAt: { type: Date, default: Date.now },
  comments: [CommentSchema]
});

const Post = mongoose.model('Post', PostSchema);

const storage = multer.diskStorage({
  destination: './uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

app.post('/api/posts', upload.single('file'), async (req, res) => {
  const { user, text } = req.body;
  const file = req.file;
  const post = new Post({
    user,
    text,
    media: file ? file.path.replace('\\', '/') : null,
    fileType: file ? file.mimetype : null,
    createdAt: new Date(),
    comments: []
  });
  await post.save();
  res.json({ success: true });
});

app.get('/api/posts', async (req, res) => {
  const page = parseInt(req.query.page) || 0;
  const limit = parseInt(req.query.limit) || 10;
  const skip = page * limit;
  
  const posts = await Post.find()
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  res.json(posts);
});

// Like a post
app.post('/api/posts/:id/love', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    post.likes += 1;
    await post.save();
    res.json({ success: true, likes: post.likes });
  } catch (err) {
    res.status(500).send('Error updating likes');
  }
});

// Add comment to post
app.post('/api/posts/:id/comments', async (req, res) => {
  try {
    const { user, text } = req.body;
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    
    const comment = {
      user,
      text,
      likes: 0,
      createdAt: new Date()
    };
    
    post.comments.push(comment);
    await post.save();
    res.json({ success: true, comment });
  } catch (err) {
    res.status(500).send('Error adding comment');
  }
});

// Delete post (by username match)
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { username } = req.body;
    const post = await Post.findById(req.params.id);
    
    if (!post) return res.status(404).send('Post not found');
    if (post.user !== username) return res.status(403).send('Unauthorized');
    
    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).send('Error deleting post');
  }
});

app.post('/api/admin/posts', async (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Forbidden');
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.delete('/api/admin/posts/:id', async (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Forbidden');
  await Post.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/all', (req, res) => res.sendFile(path.join(__dirname, 'public/all.html')));
app.get('/info', (req, res) => res.sendFile(path.join(__dirname, 'public/info.html')));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

