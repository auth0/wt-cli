# Webtask CLI
Simple command line interface for using [Webtasks](https://webtask.io)

## Setup
```
$ npm i -g wt-cli
$ wt init
```

## Usage
Write a task to a js file:

foo.js
```
return function (done) {
  done(null, 'Hello webtasks!');
}
```

Create a new task:
```
$ wt create foo.js
Webtask token:
...
Webtask URL:
https://webtask.it.auth0.com/api/run/...
$ curl -X GET https://webtask.it.auth0.com/api/run/...
Hello webtasks!
```
