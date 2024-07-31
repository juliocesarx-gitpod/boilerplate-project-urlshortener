require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const urlParser = require('url');
const mongoose = require('mongoose');
const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;

// Connect to MongoDB without deprecated options
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB successfully connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// URL Schema and model
const urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: String
});
const Url = mongoose.model('Url', urlSchema);

// Middleware setup
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Root route that serves the home page
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Simple test endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// Endpoint to create a short URL
app.post('/api/shorturl', async (req, res) => {
  const urlString = req.body.url;
  let originalUrl;

  try {
    originalUrl = new urlParser.URL(urlString);
  } catch (err) {
    return res.status(400).json({ error: 'invalid url' });
  }

  dns.lookup(originalUrl.hostname, async (err) => {
    if (err) {
      return res.status(404).json({ error: 'Address not found' });
    } else {
      try {
        let findOne = await Url.findOne({ original_url: urlString });
        if (!findOne) {
          const urlCount = await Url.countDocuments({});
          findOne = new Url({
            original_url: urlString,
            short_url: urlCount + 1
          });
          await findOne.save();
        }
        res.json({ original_url: findOne.original_url, short_url: findOne.short_url });
      } catch (dbErr) {
        console.error(dbErr);
        res.status(500).json('Server error');
      }
    }
  });
});

// Endpoint to redirect from a short URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  try {
    const url = await Url.findOne({ short_url: req.params.short_url });
    if (url) {
      res.redirect(url.original_url);
    } else {
      res.status(404).json('No URL found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).json('Server error');
  }
});

// Start the server
app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});