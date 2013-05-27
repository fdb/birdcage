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
  _.each(tweets, function(tweet) {
    console.log("SAVE " + tweet.text);
    birdcage.tweets.update({ id: tweet.id }, tweet, {upsert: true});
  });
};

birdcage.startFetcher = function(searchTerm) {
  console.log('Fetching new tweets about "' + searchTerm + '" every five seconds.');

  setInterval(function() {
    birdcage.store(searchTerm);
  }, 5000);
};

birdcage.tweetTable = function(tweets) {
  var html = '<table>';
  html += '<thead><tr><th>Date</th><th>User</th><th>Text</th></tr></thead>';
  html += '<tbody>';
  _.each(tweets, function(tweet) {
    html += '<tr>';
    html += '<td>' + tweet.created_at + '</td>';
    html += '<td>' + tweet.from_user + '</td>';
    html += '<td>' + tweet.text + '</td>';
    html += '</tr>';
  });
  html += '</tbody>';
  html += '</table>';
  return html;
};

birdcage.startServer = function() {
  var server = http.createServer(function(req, res) {
    birdcage.tweets.find().limit(100).sort([['created_at', 'desc']]).toArray(function(err, results) {
      var html = '<!DOCTYPE html><meta charset="utf-8"><html><head>';
      html += '<style>body {font:small sans-serif} table {border-collapse: collapse } td {border-top:1px solid #999;padding:10px 5px}</style>';
      html += '</head><body>';
      html += birdcage.tweetTable(results);
      html += '</html>';
      res.end(html);
    });
  });
  var port = 6633;
  console.log('Listening at http://0.0.0.0:' + port + '/');
  server.listen(port, '0.0.0.0');
};

birdcage.start = function(query) {
  birdcage._db.open(function(err) {
    if (err) {
      throw(err);
    } else {
      birdcage._db.collection('tweets', function(err, collection) {
        if (err) {
          throw(err);
        } else {
          birdcage.tweets = collection;
          birdcage.startFetcher(query);
          birdcage.startServer();
        }
      });
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
