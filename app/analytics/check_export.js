const fs = require('fs');
let code = fs.readFileSync('page.jsx', 'utf8');
console.log(code.substring(code.indexOf('const handleExport ='), code.indexOf('const handleExport =') + 1000));
