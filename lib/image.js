(function(){
  'use strict';

  var Q = require('q'),
      AWS = require('aws-sdk'),
      s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }),
      _ = require('lodash'),
      child_process = require('child_process'),
      gm = require('gm'),
      os = require('os'),
      fs = require('fs'),
      path = require('path'),
      sanitize = require("sanitize-filename"),
      bucket = process.env.AWS_S3_BUCKET;


  child_process.exec('gm -help', function(err, out, code) {
    if (err instanceof Error) {
      console.log('GM not available. Falling back to ImageMagick: ', err);
      gm = gm.subClass({ imageMagick: true });
    }
  });

  return module.exports = {
    url: url
  };

  function fileExists(key) {
    var dfd = Q.defer(),
        params = {Bucket: bucket, Key: key};

    //console.log('Params: ', params);
    s3.headObject(params, function (err, metadata) {
      //console.log('metadata', err, metadata);
      if (err && err.code === 'NotFound') {
        dfd.reject('NotFound');
      } else if(!err){
        dfd.resolve('Exists');
      } else {
        dfd.reject('Error');
      }
    });

    return dfd.promise;
  }

  function downloadFile(key) {
    var dfd = Q.defer(),
        tmpdir = os.tmpdir(),
        tmpfilename = path.resolve(tmpdir,generateUUID()),
        tmpfile = fs.createWriteStream(tmpfilename),
        params = {
          Bucket: bucket,
          Key: key
        };

    //console.log('Downloading: ', key);
    var stream = fs.createWriteStream(tmpfilename, { flags: 'w', encoding: null, mode: parseInt('0644',8) });
    s3.getObject(params).on('httpData', function(chunk) {
      stream.write(chunk);
    }).on('complete', function() {
      stream.end();
      dfd.resolve(tmpfilename);
    }).on('error', function(err) {
      console.log('downloadFile Error occured: ', err);
      stream.end();
      dfd.reject(err);
    }).send();

    return dfd.promise;
  }

  function uploadFile(tmpfilename, key) {
    var dfd = Q.defer();

    fs.readFile(tmpfilename, function (err, data) {
      if (err) {
        return dfd.reject(err);
      }

      var params = {
        Bucket: bucket,
        Key: key,
        Body: data,
        ACL: 'public-read'
      };

      s3.putObject(params, function (err) {
        if(err) {
          return dfd.reject(err);
        }
        //console.log('Successfully uploaded file: ', key);
        dfd.resolve(key);
      });
    });

    return dfd.promise;
  }

  function transformImage(key, dest, tf) {
    var dfd = Q.defer(),
        tmpdir = os.tmpdir(),
        tmpfilename = path.resolve(tmpdir,generateUUID());

    var commands = {};
    _.each(tf.split('_'), function(command){
      var cmd = command.split('=');
      commands[cmd[0]] = cmd[1].split(',');
    });

    downloadFile(key).then(function(originalTmpFile){
      var image = gm(originalTmpFile).autoOrient();

      for(var cmd in commands) {
        var args = commands[cmd];
        console.log('image['+cmd+'].apply(null, ',args);
        try {
          image = image[cmd].apply(image, args);
        } catch(e) {
          console.log('Invalid gm command: '+cmd, e);
          return dfd.reject('Invalid gm command: '+cmd);
        }
      }

      image.write(tmpfilename, function (err) {
        if (err) {
          console.log('transformError: ', err, tmpfilename);
          dfd.reject(err);
          return;
        }

        // console.log('Original file: ', originalTmpFile);
        // console.log('transformed image created: '+tmpfilename, 'Err: ', err);

        uploadFile(tmpfilename, dest).then(function(){
          fs.unlinkSync(originalTmpFile);
          fs.unlinkSync(tmpfilename);
          dfd.resolve(dest);
        }, function(err){
          dfd.reject(err);
        });
      });
    }, function(err){
      dfd.reject(err);
    });

    return dfd.promise;
  }

  function getRootUrl() {
    var bucket = process.env.AWS_S3_BUCKET,
        region = process.env.AWS_S3_BUCKET_REGION || 'us-east-1',
        url = process.env.AWS_S3_BUCKET_PUBLIC_URL;

    if(!url) {
      url = 'https://';
      if(region == 'us-east-1') {
        url += 's3.amazonaws.com/';
      } else {
        url += 's3-'+region+'.amazonaws.com/';
      }
      url += bucket;
    }

    return url;
  }

  function url(id, tf) {
    var dfd = Q.defer(),
        bucket = process.env.AWS_S3_BUCKET,
        urlRoot = getRootUrl(),
        // These two variables are used for file creation, so should have some input validation
        originalFilename = sanitize(id),
        transformedFilename = 'imageservice/'+sanitize(tf)+'/'+originalFilename;

    console.log('transformedFilename: ', transformedFilename);
    // Check if transformed file already exists, if so just redirect
    // Otherwise, download, transform and upload it S3 and then redirect
    // TODO: add a local cache that does not require talking to S3
    fileExists(transformedFilename).then(transformedImageExists, transformedImageDoesNotExist);

    return dfd.promise;

    function transformedImageExists(){
      dfd.resolve({url: urlRoot+'/'+transformedFilename});
    }

    function transformedImageDoesNotExist() {
      transformImage(originalFilename, transformedFilename, tf).then(function(){
        dfd.resolve({url: urlRoot+'/'+transformedFilename});
      }, function(err){
        dfd.reject(err);
      });
    }
  }

  function generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0;
      d = Math.floor(d/16);
      return (c=='x' ? r : (r&0x3|0x8)).toString(16);
    });
    return uuid;
  }
})();
