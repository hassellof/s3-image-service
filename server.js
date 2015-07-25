(function(){
  'use strict';

  // Include the cluster module
  var cluster = require('cluster');

  // Code to run if we're in the master process
  if (cluster.isMaster) {

      var cpuCount = require('os').cpus().length;
      for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
      }

      cluster.on('exit', function (worker) {
        console.log('Worker exit: ' + worker.id);
        cluster.fork();
      });

  // Code to run if we're in a worker process
  } else {
    var express = require('express'),
        image = require('./lib/image.js'),
        app = express(),
        port = process.env.PORT || 3000,
        redisUrl =  process.env.REDIS_URL ||
                    process.env.REDISCLOUD_URL ||
                    process.env.REDISGREEN_URL ||
                    process.env.OPENREDIS_URL ||
                    process.env.REDISTOGO_URL,
        cache = require('redis-url').connect(redisUrl);

      console.log('Redis: ', process.env.REDIS_PORT, process.env.REDIS_HOST);

      var cacheKey = req._parsedUrl.pathname + process.env.AWS_S3_BUCKET + process.env.AWS_S3_BUCKET_PUBLIC_URL;

      app.get('/image/:tf/*', function (req, res) {
        var key = req._parsedUrl.pathname.substring(('/image/'+req.params.tf+'/').length);

        cache.get(cacheKey, function(err, url){
          if(url) {
            console.log('got url from cache: ', cluster.worker.id, url);
            res.redirect(301, url);
          } else {
            console.log('Cache miss: ', cluster.worker.id);
            image.url(key, req.params.tf).then(function(image){
              cache.set(cacheKey, image.url);
              res.redirect(301, image.url);
            }, function(err) {
              if(err.code === 'NoSuchKey') {
                console.log('Does not exists');
                res.status(404).send('Error 404: File does not exists');
              } else {
                console.log('Server error: ', err);
                res.status(500).send('Error 500: Sorry, an error occured');
              }
            });
          }
        });
      });

      app.listen(port);
      console.log('Worker start: ' + cluster.worker.id);
  }
})();
