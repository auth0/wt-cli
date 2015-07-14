# Webtask CLI: all you need is code

Command line tool for using [Webtasks](https://webtask.io) to create microservices in seconds.

## Setup

```bash
$ npm i -g wt-cli
$ wt init
```

## Usage

Write webtask code to the *foo.js* file:

```javascript
module.exports = function (cb) {
  cb(null, 'Hello webtasks!');
}
```

Create a new webtask...

```bash
$ wt create foo.js
https://webtask.it.auth0.com/api/run/...
```

... and call it:

```bash
$ curl https://webtask.it.auth0.com/api/run/...
Hello webtasks!
```
## More

Explore the possibilies at [https://webtask.io](https://webtask.io).