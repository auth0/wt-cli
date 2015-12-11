### Create

Creates a webtask based on a local file and returns a URL that can be used to execute it.

```bash
$ wt create foo.js
```

> Specifying `--watch` modifier will watch for file changes and refresh the webtask

### Create from URL

Creates a webtask that when called it will fetch the code from that public URL and execute it. By default the code is not cached, use `--prod` modifier to get a URL where the code is cached.

```bash
$ wt create https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/html-response.js \
          --name html-response-url
```

### Logs

Shows the log streaming of all your webtasks. All `console.log` calls will be available.

```bash
$ wt logs
```

### Secrets

Create a webtask that depends on a secret (a mongodb connection string).

```bash
$ wt create https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/mongodb.js \
          --name mongo \
          --secret MONGO_URL=mongodb://webtask:supersecret@ds047592.mongolab.com:47592/webtask-examples
```

> Secrets are encrypted with AES256-CBC. This is a real mongodb URL (powered by mongolab), no guarantee that it will work :)

### Cron

Cron a webtask that will run every 10 minutes.

```bash
$ wt cron schedule -n mongocron \
                 -s MONGO_URL=mongodb://webtask:supersecret@ds047592.mongolab.com:47592/webtask-examples \
                 "*/10 * * * *" \
                 https://raw.githubusercontent.com/auth0/wt-cli/master/sample-webtasks/mongodb.js
```

### Express.js

You can use the [express](https://expressjs.org) framework inside a webtask. Specify `--no-parse` and `--no-merge` modifiers to keep the request raw.

```bash
$ wt create express.js --no-parse --no-merge
```

### Cron history

Get a history of all the runs of a specific cron.

```bash
$ wt cron history mongogron
```

### Crons

Get a list of all the crons you have registered.

```bash
$ wt cron ls
```
