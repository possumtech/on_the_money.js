import Linter from './Linter.js';

export default class Cli {
  static run(args = []) {
    console.log('on_the_money.js Linter (Experimental)');
    return args.includes('--check');
  }
}
