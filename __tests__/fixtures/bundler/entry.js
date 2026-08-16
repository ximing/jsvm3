import { JSVM, loadArtifact } from 'jsvm3/runtime';

export function runArtifact(artifact) {
  const vm = new JSVM();
  vm.exec(loadArtifact(artifact));
  return vm.realm.globalObj.module.exports;
}
