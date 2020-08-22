var express = require('express');
var router = express.Router();
var request = require('request');
var cheerio = require('cheerio');
var async = require('async');
var url = require('url');
var fs = require('fs');
var ImageData = require('./imagedata');
var _ = require('lodash');

let images = new Map();

let crawled = [];
let inboundLinks = [];
let base;

var sanitizeLink = function(uri){
  if(uri.substr(0,2)==="//")
    return "https://"+uri.substr(2);
  else
    return uri;
}

function download(uri){
  uri = sanitizeLink(uri);
  var path = "./images/";
  var filename = uri.split('/').pop().split('#')[0].split('?')[0];
  request.head(uri, (err, res, body) => {
    if(!images.get(uri)){
        request(uri)
        .pipe(fs.createWriteStream(path+filename))
        .on('close', () => {
          images.set(uri, new ImageData(uri,path+filename,1, fs.statSync(path+filename).size));
        });
      }
      else{
        var imgdata= images.get(uri);
        images.set(uri, new ImageData(uri,path+filename,imgdata.occurence+1, fs.statSync(path+filename).size));
      }
  });
};

function makeRequest(domain){
  const options = {
    url: domain,
    headers: {
      'User-Agent': 'Mozilla\/5.0 (Windows NT 6.3; WOW64) AppleWebKit\/537.36 (KHTML, like Gecko) Chrome\/59.0.3071.115 Safari\/537.36'
    }
  };
  request(options, function(error, res, body){
    if(error){
      return "no error";
    }
    let pageObject = {};
    pageObject.links = [];
    let $ = cheerio.load(body);
    pageObject.title = $('title').text();
    pageObject.url = domain;
    $('a').each(function(i, elem){
      pageObject.links.push({linkText: $(elem).text(), linkUrl: elem.attribs.href})
    });

    $('img').each(function(i,elem){
      download($(elem).attr('src'));
    });
  })
}

function crawlAndSave(link){
  makeRequest(link, function(error, pageObject){
    console.log(pageObject);
    crawled.push(pageObject.url);
    async.eachSeries(pageObject.links, function(item, cb){
      parsedUrl = url.parse(item.linkUrl);
      // test if the url actually points to the same domain
      if(parsedUrl.hostname == base){
        /*
         insert some further link error checking here
        */
        inboundLinks.push(item.linkUrl);
      }
      cb();
    }
    ,function(){
      var nextLink = _.difference(_.uniq(inboundLinks), crawled);
      if(nextLink.length > 0){
        myLoop(nextLink[0]);
      }
      else {
        console.log('done!');
      }
    });
  });
  console.log(images);
}

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/', function(req, res){
  base = req.body.domain;
  if(!base){
    return res.status(422).json({errors: {domain: "can't be blank"}});
  }
  crawlAndSave(base);
  return res.status(200).json({result: "Successful"});
});

module.exports = router;
