Function.prototype.stringify = function () {
    var match = this.toString().match(/[^]*\/\*([^]*)\*\/\s*\}$/);
    return match ? match[1] : '';
};

module.exports = function (ctx, req, res) {
    if (req.method !== 'GET') 
        return error(404);

    if (!ctx.data.logging_url) 
        return error(400, 'Missing logging_url parameter');

    res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-control': 'nocache' });
    return res.end(require('ejs').render(view.stringify(), ctx));

    function error(code, err) {
        console.log(code + (err ? (': ' + err) : ''));
        res.writeHead(code);
        res.end(err);
        return false;
    }
};

function view() {/*
<html>
<head>
    <title><%= (data.container || 'system') %> logs</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="shortcut icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAATQAAAE0BAMAAABQr9KsAAAAD1BMVEVuNj/ydGb4m1r46mD////RtkIJAAABGUlEQVR42u3OUQ3CUBQEUcDBSqBggKCApP41oeA+vtosyRkDcy57bdW0S2loaENoFaGhDaFVhIY2hFYRGtoQWkVoaENoFaGhDaFVhIY2hFYRGtoQWkVoaENoFaGhDaFV9JN22w7rnmVoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaBsaGtqGhoa2/RntuS97L3uhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGdRnus52hoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaOfRrjkutKChoQUNDS1oaGhBQ0MLGhpa0NDQgoaGFjQ0tKChoQUNDS1oaGhBa6Gt++TwZlptxbQv6GKjf4hhEBgAAAAASUVORK5CYII=" type="image/x-icon" sizes="16x16">
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/css/bootstrap.min.css" />
    <style>
        body {
            padding-top: 70px;
        }
        .wt-logs-msg {
            word-wrap: break-word;
            white-space: pre;
            padding-right: 5px;
        }
        .wt-logs-time {
            width: 250px; 
            white-space: nowrap;
        }
        .wt-details {
            word-wrap: break-word;
            white-space: pre;
        }
        #logs {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
        }
    </style>
    <script src="https://code.jquery.com/jquery-2.1.4.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.4/js/bootstrap.min.js"></script>

    <script>

        var query = getParams(window.location.search.substring(1));
        var hash = getParams(window.location.hash.substring(1));
        var params = {
            buffer: query.buffer || hash.buffer,
            max: query.max || hash.max,
            filter: query.filter || hash.filter
        };
        if (isNaN(params.buffer))
            params.buffer = 100;
        else
            params.buffer = Math.floor(Math.max(Math.min(+params.buffer, 1000), 10));
        if (isNaN(params.max) || params.max < 1)
            params.max = undefined;
        else 
            params.max = Math.floor(+params.max);
        if (params.filter)
            params.filter = params.filter.trim();

        $(function () {
            $('#details').on('shown.bs.modal', function () {
              $('#details-close').focus();
            });

            var url = <%- JSON.stringify(data.logging_url) %> 
                + '?key=' + <%- JSON.stringify(token) %>;
            if (params.max)
                url += "&max=" + params.max;
            var stream = new EventSource(url);
            var msg_id = -1, max_id = 100000;
            stream.onmessage = function (e) {
                var data = e.data;
                try {
                    data = JSON.parse(data);
                }
                catch (e) {}
                if (typeof data === 'string') {
                    $("#logs tbody").append(
                        "<tr><td>&nbsp;</td><td class=\"wt-logs-msg\">" + 
                        $("#factory").text(data).html() + 
                        "</td></tr>");
                }
                else {
                    msg_id = ++msg_id % max_id;
                    $("#logs tbody").append(
                        "<tr><td><a href=\"#\" id=\"details-" + msg_id + "\">" + (data.time || "&nbsp;") + "</a></td>" +
                        "<td class=\"wt-logs-msg\">" + (data.msg ? $("#factory").text(data.msg).html() : "&nbsp;") +
                        "</td></tr>");
                    $('#details-' + msg_id).click(function () {
                        var data = JSON.parse(
                            $(this).parent().parent().attr('data-log'));
                        $('#details-id').html(data.time || 'N/A');
                        $('#details-body').html(JSON.stringify(data, null, 2));
                        $('#details').modal({
                            keyboard: true
                        });
                        return false;
                    });
                }
                if (filter_match(e.data)) {
                    $('#logs tr:last').attr('data-log', e.data);
                    scroll();
                }
                else
                    $('#logs tr:last').attr('data-log', e.data).hide();
            };
            stream.onerror = function (e) { 
                $('#status').html('Disconnected')
                    .removeClass('btn-info btn-success')
                    .addClass('btn-danger');
                $("#logs tbody").append(
                    "<tr><td>&nbsp;</td><td class=\"wt-logs-msg\">Disconnected by the server</td></tr>");
                scroll();
                stream.close();
                $('#stop').hide();
            }
            stream.onopen = function () { 
                $('#status').html('Connected')
                    .removeClass('btn-info btn-error')
                    .addClass('btn-success');
                $('#stop').show();
            }
            stream.addEventListener("ping", stream.onopen);

            $('#stop').click(function () {
                $('#status').html('Disconnected')
                    .removeClass('btn-info btn-success')
                    .addClass('btn-danger');
                $("#logs tbody").append(
                    "<tr><td>&nbsp;</td><td class=\"wt-logs-msg\">Stopped</td></tr>");
                $('#stop').hide();
                scroll();
                stream.close();
            });

            $('#filter')
                .bind('input propertychanged', filter_changed)
                .keydown(function(e) {
                    if(e.keyCode == 13) 
                        return false; 
                });

            if (params.filter) {
                $('#filter').val(params.filter);
                filter_changed();
            }

            var current_filter;
            var update_timer;
            function filter_changed() {
                var val = $('#filter').val().trim();
                try {
                    current_filter = val.length > 0 ? new RegExp(val, 'i') : undefined;
                    $('#filterg').removeClass('has-error');
                }
                catch (e) {
                    current_filter = undefined;
                    $('#filterg').addClass('has-error');
                }
                if (update_timer)
                    clearTimeout(update_timer);
                update_timer = setTimeout(filter, 1500);
            }

            function filter() {
                update_timer = undefined;
                $('#logs tr').each(function () {
                    var log = $(this).attr('data-log');
                    if (!log)
                        return;
                    if (filter_match(log))
                        $(this).show();
                    else
                        $(this).hide();
                });
            }

            function filter_match(v) {
                return !current_filter || v.match(current_filter);
            }

            function scroll() {
                if ($("#scroll").is(':checked')) {
                    $(window).scrollTop($(document).height());
                }
                var count = $('#logs tr').length - 1;
                while (count-- > params.buffer)
                    $('#logs tr:eq(1)').remove();
            }
        });

        function getParams(str) {
            var params = {};
            var e,
                a = /\+/g,  // Regex for replacing addition symbol with a space
                r = /([^&;=]+)=?([^&;]*)/g,
                d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
                q = str;

            while (e = r.exec(q))
               params[d(e[1])] = d(e[2]);

            return params;
        }

    </script>
</head>
<body>
    <div id="details" class="modal">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <h4 class="modal-title" id="details-id"></h4>
          </div>
          <div class="modal-body">
            <p id="details-body" class="wt-details"></p>
          </div>
          <div class="modal-footer">
            <button id="details-close" type="button" class="btn btn-primary" data-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
    <nav class="navbar navbar-default navbar-fixed-top">
      <div class="container-fluid">
        <div class="navbar-header">
            <a class="navbar-brand" href="https://webtask.io">
                <img alt="Auth0" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAATQAAAE0BAMAAABQr9KsAAAAD1BMVEVuNj/ydGb4m1r46mD////RtkIJAAABGUlEQVR42u3OUQ3CUBQEUcDBSqBggKCApP41oeA+vtosyRkDcy57bdW0S2loaENoFaGhDaFVhIY2hFYRGtoQWkVoaENoFaGhDaFVhIY2hFYRGtoQWkVoaENoFaGhDaFV9JN22w7rnmVoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaBsaGtqGhoa2/RntuS97L3uhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGdRnus52hoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaGhoaOfRrjkutKChoQUNDS1oaGhBQ0MLGhpa0NDQgoaGFjQ0tKChoQUNDS1oaGhBa6Gt++TwZlptxbQv6GKjf4hhEBgAAAAASUVORK5CYII=" width="20" height="20">
            </a>
        </div>
        <h4 class="navbar-text"><%= (data.container || 'system') %> logs</h4>
        <button type="button" id="status" class="btn btn-info navbar-btn" disabled="disabled">Connecting...</button>
        <button type="button" id="stop" class="btn btn-danger navbar-btn" style="display:none">Stop</button>
        <div class="navbar-form navbar-right" >
            <div class="checkbox">
            <label>
              <input id="scroll" type="checkbox" checked="checked"/> auto-scroll 
            </label>
            </div>
            <div id="filterg" class="form-group">
                <input id="filter" type="text" class="form-control" placeholder="Filter regex...">
            </div>
        </div>
      </div>
    </nav>
    <div id="factory" hidden></div>
    <table id="logs" class="table table-striped table-condensed">
        <colgroup>
            <col class="wt-logs-time">
        </colgroup>
        <tr><th>Time</th><th>Message</th></tr>
    </table>
</body>
</html>
*/}
