# [S3 Image Service](https://github.com/ombori/s3-image-service)
Service for on demand transformation of images stored in an Amazon S3 bucket

This prerelease software. We use it in limited production ourselves but would not recommend it for general use just yet.

* **URL interface:** Apply any GraphicsMagick transformation just by specifying the functions in the URL. If GraphicsMagick is not available on your system (like Heroku) it falls back to ImageMagick.
* **Fast** Generated images are cached in Amazon S3. Redis is used as an in memory cache to reduce calls to S3.
* **Easy to deploy:** Deploy it in Docker or Heroku, set some environment variables and you are good to go.

## Available transformations
You can apply any gm transformations, see [http://aheckmann.github.io/gm/docs.html](http://aheckmann.github.io/gm/docs.html) for more information. Syntax is `function=arguments`, multiple arguments are separated by `,` and multiple functions are separated by `_`. Options objects are not yet supported.

## Examples

You have a large size image called  `IMAGE123.jpg` in your S3 bucket and you want to create a thumbnail with pixel dimension 100x100
```html
<img src="http://s3-image-service/image/resize=100,100/IMAGE123" />
```
Image service will  create the file  `imageservice/resize=100,100/IMAGE123.jpg`, store it in your S3 bucket and redirect the browser to the resulting URL. Subsequent requests to  `http://s3-image-service/image/resize=100,100/IMAGE123.jpg` will not resize the image again but instantly 301 redirect to the previously generated thumbnail.

To apply multiple transformations on IMAGE123.jpg, in this case a resize to 500x500px, add blur and a charcoal filter

```html
<img src="http://s3-image-service/image/resize=500,500_charcoal=3_blur=4/IMAGE123.jpg" />
```

## Getting started
The app requires the following environment variables:

* REDIS_URL
* AWS_ACCESS_KEY_ID
* AWS_SECRET_ACCESS_KEY
* AWS_S3_BUCKET
* AWS_S3_REGION (optional)
* AWS_S3_BUCKET_PUBLIC_URL (optional)

Dockerfile is included.

## How to deploy on heroku

1. Clone this project and change working directory to repository
```
    $ git clone git@github.com:ombori/s3-image-service.git
    $ cd s3-image-service
```

2. Create heroku app
```
    $ heroku create
    Creating protected-ocean-3023... done, stack is cedar-14
    https://protected-ocean-3023.herokuapp.com/ | https://git.heroku.com/protected-ocean-3023.git
    Git remote heroku added
    updating Heroku CLI...done. Updated to 3.40.6
```

3. Add a redis instance to your heroku app. s3-image-service looks for heroku environment variables for rediscloud, RedisGreen, Open Redis and Redis to Go by default. However, environment variable REDIS_URL has priority.
```
    $ heroku addons:create rediscloud:30
```

4. Set your AWS S3 credentials in heroku config
```
    $ heroku config:set AWS_ACCESS_KEY_ID="ABC123"
    $ heroku config:set AWS_SECRET_ACCESS_KEY="321CBA"
    $ heroku config:set AWS_S3_BUCKET="bucket-name"
    $ heroku config:set AWS_S3_BUCKET_REGION="us-east-1"
```

5. Deploy your app to the cloud
```
    $ git push heroku master
```

6. (Optional) Set front facing URL of S3 bucket. If you use a CDN like Amazon CloudFront to serve images from S3, provide the public URL as a heroku setting
```
    $ heroku config:set AWS_S3_BUCKET_PUBLIC_URL="https://something.cloudfront.net"
```
