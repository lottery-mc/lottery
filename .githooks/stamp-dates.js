// Stamp today's date into SEO freshness fields. Safe full read/write (no
// in-place edits), only writes when something actually changed.
const fs = require("fs");
const today = new Date().toISOString().slice(0, 10);

function stamp(file) {
  if (!fs.existsSync(file)) return;
  const before = fs.readFileSync(file, "utf8");
  let s = before
    .replace(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g, `<lastmod>${today}</lastmod>`)
    .replace(/("dateModified":\s*")\d{4}-\d{2}-\d{2}(")/g, `$1${today}$2`);
  if (s !== before) fs.writeFileSync(file, s);
}

["sitemap.xml", "index.html", "build.html", "stats.html", "account.html"].forEach(stamp);
