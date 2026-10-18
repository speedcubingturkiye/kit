import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// `import design from './designs/X.dc.html?dc'` turns a design-canvas artboard into a module: its <x-dc> markup
// becomes a string and its Component class plain code, so nothing is evaluated at run time (see src/dc.ts).
function dcHtml(): Plugin {
  return {
    name: 'dc-html',
    enforce: 'pre',
    load(id) {
      const [file, query] = id.split('?');
      if (query !== 'dc') return null;
      const src = readFileSync(file, 'utf8');
      const markup = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(src)?.[1].replace(/<helmet>[\s\S]*?<\/helmet>/, '').trim();
      const code = /<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(src)?.[1];
      if (!markup || !code) throw new Error(`${file}: no <x-dc> markup or Component script`);
      return `class DCLogic { constructor(props) { this.props = props; } }\n${code}\nexport default { markup: ${JSON.stringify(markup)}, Component };\n`;
    },
  };
}

export default defineConfig({ plugins: [dcHtml()] });
