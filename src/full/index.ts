// Thin facade: Rollup must leave jsvm3/runtime and jsvm3/compiler external
// so this entry never embeds a second JSVM / InsMap.
export {
  JSVM,
  fromJson,
  loadArtifact,
  ArtifactFormatError,
  ArtifactVersionError,
  ArtifactLoadError,
  CompileError,
} from 'jsvm3/runtime';
export { transform, transformEXP } from 'jsvm3/compiler';
