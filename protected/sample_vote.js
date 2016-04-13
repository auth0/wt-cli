'use latest';
'use strict';

var jade = require('jade');
var fs = require('fs');

module.exports = function(context, req, res) {
	var userProfile = req.user.userProfile;
	if (!userProfile.email.endsWith("@auth0.com")) {
		res.end("Only auth0.com emails can vote :(");
	}

	var projects = [
	  'Breached DB anomaly',
	  'Protected webtask',
	  'Webtask dash',
	  'Key vault',
	  'Auth0 analytics / Users dash',
	  'Troubleshooting toolkit',
	  'Codeless rules templates',
	  'Dashboard indes',
	  'Users widget',
	  'Pipeline unification',
	  'Lock for the blind',
	  'Users exporter',
	  'DB inconsistencies',
	  'DB inconsistencies'
	];

	if (req.body.vote) {
		updateVotes(context, req, res, projects, sendResults);
	} else {
		showPoll(context, req, res, projects);
	}
};

function showPoll(context, req, res, projects) {
  var token = req.apiToken;
  var userProfile = req.user.userProfile;

  var template =[
    'html',
    '  head',
    '  body',
    '    form#form',
    '      h1 Hello, #{email} #{verified ? "(verified)" : ""}. What project should win the hackaton?',
    '      each val, index in projects',
    '        p',
    '          button(type="button", name="vote", value=index, data-no)= val',
    '    script(src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.0.0-beta1/jquery.min.js")',
    '    script.',
	'      (function() {',
	'        var $form = $("#form");',
	'',
	'        $("#form button").on("click", function(e) {',
	'        e.preventDefault();',
	'',
	'        var $this = $(e.target);',
	'',
	'        $.ajax({',
	'          type: "POST",',
	'          dataType: "json",',
	'          url: window.location.href,',
	'          headers: {',
	'              "Authorization":  "Bearer " + sessionStorage.getItem("token")',
	'          }, ',
	'          data: {',
	'              vote: $this.val()',
	'          }',
	'        })',
	'        .then(function(data) {',
	'           var $container = $("<div>");',
	'           $container.append($("<div>").text("Thanks #{email}!"));',
	'           $container.append($("<h3>").text("Results:"));',
	'           $container.append($("<pre><code>").text(JSON.stringify(data, null, 4)));',
	'           $("body").empty().append($container);',
	'        }, function() {',
	'          console.log("Reject");',
	'        });',
	'      });',
	'      })();',
  ].join('\n');

  var content = jade.compile(template)({
    token: token,
    email: userProfile.email,
    verified: userProfile.email_verified,
    projects: projects
  });

  res.end(content);
}

function sendResults(context, req, res, projects, data) {
	var d = [];
	projects.forEach(function(item, index) {
		d.push({project: item, votes: data.votes[index] || 0});
	});
  res.end(JSON.stringify(d));
}

function updateVotes(context, req, res, projects, cb) {
  var state = req.body.vote;

  context.storage.get(function (err, data) {
    if (err) {
      return res.end(err);
    }

    data = data || {votes: [], emails: []};

    console.log("BEFORE DATA:", data);

    var userProfile = req.user.userProfile;
    if (data.emails.indexOf(userProfile.email) === -1) {
      data.votes[state] = data.votes[state] ? data.votes[state] + 1 : 1;
      data.emails.push(userProfile.email);
    }

    console.log("AFTER DATA:", data);

    context.storage.set(data, function(err) {
      if (err) {
        return res.end(err);
      }

      cb(context, req, res, projects, data);
    })
  });
}
