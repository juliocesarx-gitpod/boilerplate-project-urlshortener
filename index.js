require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const urlParser = require('url');
const mongoose = require('mongoose');
const app = express();

// Basic server configuration
const port = process.env.PORT || 3000;

// Ensure MONGO_URI is defined
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI is not defined in the environment variables");
  process.exit(1);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB successfully connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Schema for URLs
const urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: String
});
const Url = mongoose.model('Url', urlSchema);

// Setup middleware
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve homepage
app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Simple API endpoint for testing
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// Create a short URL
app.post('/api/shorturl', async (req, res) => {
  const urlString = req.body.url;
  let originalUrl;
  
  // Validate URL format using URL constructor
  try {
    originalUrl = new urlParser.URL(urlString);
    // Check if protocol is http or https
    if (!['http:', 'https:'].includes(originalUrl.protocol)) {
      throw new Error('Invalid URL format');
    }
  } catch (err) {
    // Return error if URL is invalid
    return res.json({ error: 'invalid url' });
  }

  // Check if the URL hostname exists using DNS lookup
  dns.lookup(originalUrl.hostname, async (err) => {
    if (err) {
      // URL hostname not found
      return res.json({ error: 'invalid url' }); 
    } else {
      try {
        let findOne = await Url.findOne({ original_url: urlString });
        if (!findOne) {
          // If URL not found, create a new short URL
          const urlCount = await Url.countDocuments({});
          findOne = new Url({
            original_url: urlString,
            short_url: urlCount + 1
          });
          await findOne.save();
        }
        // Return the original and short URL
        res.json({ original_url: findOne.original_url, short_url: findOne.short_url });
      } catch (dbErr) {
        // Handle database errors
        console.error(dbErr);
        res.status(500).json('Server error');
      }
    }
  });
});

// Redirect from a short URL
app.get('/api/shorturl/:short_url', async (req, res) => {
  try {
    const url = await Url.findOne({ short_url: req.params.short_url });
    if (url) {
      // Redirect to the original URL if found
      res.redirect(url.original_url);
    } else {
      // Return error if short URL does not exist
      return res.status(404).json({ error: 'No URL found' }); 
    }
  } catch (err) {
    // Handle server errors
    console.error(err);
    res.status(500).json('Server error');
  }
});

// Start the server and listen on the configured port
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});