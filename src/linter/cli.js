import Linter from './Linter.js';

export default class Cli {
  static run(args) {
    console.log('on_the_money.js Linter (Experimental)');
    // Implementation will follow Phase 2
  }
}

// Support executing from terminal
if (import.meta.url.endsWith(process.argv[1])) {
  Cli.run(process.argv.slice(2));
}
