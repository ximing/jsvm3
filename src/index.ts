import { registerOpcodes } from './opcodes/ins';

registerOpcodes();

export * from './vm';
export { fromJson, loadArtifact } from './utils/convert';
export {
  JSVMError,
  JSVMTimeoutError,
  JSVMTypeError,
  JSVMRangeError,
  JSVMReferenceError,
  JSVMSyntaxError,
} from './utils/errors';
export {
  ArtifactFormatError,
  ArtifactVersionError,
  ArtifactLoadError,
  CompileError,
} from './artifact';
