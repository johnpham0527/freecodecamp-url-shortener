const express = require('express');
const app = express();
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env' });
const bodyParser = require('body-parser');
const path = require('path');
const dns = require('dns');
const AutoIncrement = require('mongoose-sequence')(mongoose);

express.static("/");
app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.urlencoded({extended: 'false'}));
app.use(bodyParser.json());

mongoose.connect(
    process.env.MONGO_URI,
    { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      useCreateIndex: true
    }
  ); 

/*** URL Shortener Microservice 
*******************************/
const Schema = mongoose.Schema;

const urlSchema = new Schema(
  {
    original_url: {
      type: String,
      required: true
    }
  }
);

urlSchema.plugin(AutoIncrement, {inc_field: 'short_url'});

const ShortURL = mongoose.model("ShortURL", urlSchema);

var createAndSaveURL = function(link, done) {
  var newUrl = new ShortURL(
    { original_url: link }
  );

  newUrl.save(function(err, data) {
    if (err) {
      done(err);
    }
    else {
      done(null, data);
    }
  });
};

var findURLByShortLink = function(shortLinkId, done) {
  ShortURL.findOne({short_url: shortLinkId}, function(err, data) {
    if (err) {
      done(err);
    }
    else {
      done(null, data);
    }
  })
};

var findURLByName = function(givenUrl, done) {
  ShortURL.findOne({original_url: givenUrl}, function(err, data) {
    if (err) {
      done(err);
    }
    else {
      done(null, data);
    }
  })
}

const isValidUrl = (url) => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
        return true;
  }
  console.log(`${url} is not a valid URL`);
  return false;
}

const stripHTTP = (validUrl) => {
  let domain = validUrl;

  if (validUrl.startsWith("http://")) {
    domain = validUrl.substring(7);
  }
  else if (validUrl.startsWith("https://")) {
    domain = validUrl.substring(8);

  }

  console.log(`Domain: ${domain}`);
  return domain;
}

app.post('/api/shorturl/new', function(req, res, next) {
  let givenUrl = req.body.url;

  if (!isValidUrl(givenUrl)) { //this is not a valid URL because it doesn't start with http:// or https://
    res.send({
      "error": "invalid URL"
    });
    return next(`${givenUrl} is not a valid URL.`);
  }

  let domain = stripHTTP(givenUrl);

  dns.lookup(domain, (err, address, family) => { //look up domain (stripped of http:// or https://)
    if (err) { //invalid URL: send error response
      console.log(err);
      res.send({
        "error": "invalid URL"
      });
    }
    else { //valid URL: save and return response
      //Does this URL already exist in the database?
      findURLByName(givenUrl, function(err, data) {
        if (err) { //handle any errors
          return (next(err));
        }
        
        if (data) { //the data exists, so return its data
          res.json({
            original_url: data.original_url,
            short_url: data.short_url
          });
        }
        else { //It doesn't exist yet, so create it
          createAndSaveURL(givenUrl, function(err, data) {
            if (err) {
              return (next(err));
            }
    
            res.json({
              original_url: data.original_url,
              short_url: data.short_url
            });
          });
        }
      });
    }
  });
})

app.get('/api/shorturl/:url', function(req, res, next) {
  const shortLink = parseInt(req.params.url);

  findURLByShortLink(shortLink, function(err, data) {
    if (err) {
      return next(err);
    }

    res.redirect(301, data.original_url);
  })
})


app.listen(3000, () => {
    console.log("URL Shortener Microservice is ready.");
});