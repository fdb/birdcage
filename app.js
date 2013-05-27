var querystring = require('querystring');
var request = require('request');
var mongodb = require('mongodb');
var http = require('http');
var program = require('commander');
var _ = require('underscore');

var birdcage = {};
birdcage._db = new mongodb.Db('birdcage', new mongodb.Server('127.0.0.1', 27017), {safe: false});

birdcage.searchUrl = function(searchTerm) {
  var q = querystring.stringify({q: searchTerm, rpp: 100});
  return 'http://search.twitter.com/search.json?' + q;
};

birdcage.store = function(searchTerm) {
  request(birdcage.searchUrl(searchTerm), function (error, response, body) {
    if (response.statusCode === 200) {
      var jsonBody = JSON.parse(body);
      var tweets = jsonBody.results;
      birdcage._saveTweets(tweets);
    }
  });
};

birdcage._saveTweets = function(tweets) {
  birdcage._db.collection('tweets', function(err, collection) {
    if (err) {
      console.log(err);
      return;
    }
    _.each(tweets, function(tweet) {
      console.log("SAVE " + tweet.text);
      collection.update({ id: tweet.id }, tweet, {upsert: true});
    });
  });
};

birdcage.startFetcher = function(searchTerm) {
  console.log('Fetching new tweets about "' + searchTerm + '" every five seconds.');

  setInterval(function() {
    birdcage.store(searchTerm);
  }, 5000);
};

birdcage.start = function(query) {
  birdcage._db.open(function(err) {
    if (err) {
      throw(err);
    } else {
      birdcage.startFetcher(query);
    }
  });
};

program
  .version('0.0.1')
  .usage('[options] <search term>')
  .parse(process.argv);

if (program.args.length !== 1) {
  program.help();
} else {
  var searchTerm = program.args[0];
  birdcage.start(searchTerm);
}
