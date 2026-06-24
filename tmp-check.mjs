import fs from 'fs';
const c = fs.readFileSync('/home/alex/proyectos/warframeweb/packages/web/dist/assets/index-CVN7LHY_.js', 'utf8');
const renderCount = (c.match(/render\.com/g) || []).length;
const warpCount = (c.match(/warframeweb-api/g) || []).length;
console.log('render.com occurrences:', renderCount);
console.log('warframeweb-api occurrences:', warpCount);
if (warpCount > 0) {
  const idx = c.indexOf('warframeweb-api');
  console.log('Context:', c.substring(Math.max(0, idx - 30), idx + 60));
}
const apiCount = (c.match(/\/api/g) || []).length;
console.log('/api occurrences:', apiCount);
