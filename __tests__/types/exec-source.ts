import { JSVM } from '../../src/vm/vm';

const vm = new JSVM();
// @ts-expect-error JSVM.exec does not accept source strings
vm.exec('source');
