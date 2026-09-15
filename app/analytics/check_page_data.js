const fs = require('fs');
let code = fs.readFileSync('page.jsx', 'utf8');
console.log(code.substring(code.indexOf('useEffect(() => {'), code.indexOf('useEffect(() => {') + 1000));
