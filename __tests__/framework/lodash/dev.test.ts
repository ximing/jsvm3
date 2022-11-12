import { run } from '../../helper';
import { _ } from './lodash';

console.log(_.intersection([2, 1], [2, 3]));

describe('dev', function () {
  it('context var', function () {
    expect(
      run(
        `
    module.exports = 1;
    `
      )
    ).toEqual(1);
  });
});
