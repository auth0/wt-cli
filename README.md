# Webtask CLI: all you need is code

Command line tool for using [webtasks](https://webtask.io) to create microservices in seconds.

## Setup

```bash
$ npm i -g wt-cli
$ wt init
```

## Usage

### Create a webtask

Write webtask code to the *hello-world.js* file:

```javascript
module.exports = function (cb) {
  cb(null, 'Hello webtasks!');
}
```

```bash
wt create hello-world.js
```

and call it...

```bash
curl https://webtask.it.auth0.com/api/run/{yours}/hello-world
```

### Create a webtask (from a public URL)

```bash
wt create https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/html-response.js \
          --name html-response-url
```

### Create a webtask with a secret

```bash
wt create https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/mongodb.js \
          --name mongo \
          --secret MONGO_URL=mongodb://webtask:supersecret@ds047592.mongolab.com:47592/webtask-examples
```

> This is a real mongodb URL (powered by mongolab), no guarrantee that it will work :)

### Create a webtask that integrates with express.js

```bash
wt create https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/express.js \
          --name express \
          --no-parse --no-merge
```


### Log streaming

```bash
wt logs
```

### Cron a webtask (long running)

```bash
wt cron schedule -n mongocron \
                 -s MONGO_URL=mongodb://webtask:supersecret@ds047592.mongolab.com:47592/webtask-examples \
                 "*/10 * * * *" \
                 https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/mongodb.js
```

> This cron will insert a document in a mongo collection every 10 minutes

### Get cron history

```bash
wt cron history mongogron
```

### Get all crons

```bash
wt cron ls
```
