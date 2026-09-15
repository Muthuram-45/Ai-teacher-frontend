const fs = require('fs');
let code = fs.readFileSync('page.jsx', 'utf8');
console.log(code.substring(code.indexOf('<OverviewTab'), code.indexOf('<OverviewTab') + 200));
