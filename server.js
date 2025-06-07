
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

const Post = mongoose.model('Post', new mongoose.Schema({
  likes: { type: Number, default: 0 },
  user: String,
  text: String,
  media: String,
  fileType: String,
  createdAt: Date
}));

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
    createdAt: new Date()
  });
  await post.save();
  res.json({ success: true });
});

app.get('/api/posts', async (req, res) => {
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
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

app.get('/api/admin/posts', async (req, res) => {
  if (req.query.password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Forbidden');
  const posts = await Post.find().sort({ createdAt: -1 });
  res.json(posts);
});

app.delete('/api/admin/posts/:id', async (req, res) => {
  if (req.query.password !== process.env.ADMIN_PASSWORD) return res.status(403).send('Forbidden');
  await Post.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/all', (req, res) => res.sendFile(path.join(__dirname, 'public/all.html')));
app.get('/info', (req, res) => res.sendFile(path.join(__dirname, 'public/info.html')));

const PORT = process.env.PORT || 5000;

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const post = new Post({
      name: req.body.name,
      text: req.body.text || '',
      file: req.file ? '/uploads/' + req.file.filename : '',
      love: 0
    });
    await post.save();
    res.redirect('/');
  } catch (err) {
    res.status(500).send('Upload failed');
  }
});

app.post('/delete/:id', async (req, res) => {
  const id = req.params.id;
  const pwd = req.body.password;
  if (pwd !== "pronafij") return res.status(403).send("Forbidden");
  try {
    await Post.deleteOne({ _id: new mongoose.Types.ObjectId(id) });
    res.redirect('/admin.html');
  } catch {
    res.status(500).send("Failed to delete");
  }
});
