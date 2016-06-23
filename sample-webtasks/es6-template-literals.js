"use latest";

module.exports = function (context, req, res) {
    let templateLiteral = `<h1>Howdy, ${context.data.name}!</h1>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(templateLiteral);
}
