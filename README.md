# Badgifier
**[Webpage](https://badgifier.dallasmcneil.com)**

**Badgifier generates customisable name badges, personal schedules and certificates for WCA competitions**

### Development

Badgifier is a static site using jQuery, SCSS and Bootstrap 4.

1. Pull down this repo.
2. Serve the diretory. One option using python3 is `python -m http.server` and navigate to the site. You can also open `index.html` directly in the browser but CORS may prevent some assets from loading.

Upon updating any SCSS file, you will need to run `sass scss/style.scss:scss/style.css` or during development you can run `sass --watch scss/style.scss:scss/style.css`. To install SASS, you must have NPM installed and run `npm install -g sass
