export class ArtifactFormatError extends Error {
  readonly code: 'ARTIFACT_FORMAT';
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly display: 'ArtifactFormatError';

  constructor(message: string, expected?: unknown, actual?: unknown) {
    super(message);
    this.name = 'ArtifactFormatError';
    this['code'] = 'ARTIFACT_FORMAT';
    this['display'] = 'ArtifactFormatError';
    this['expected'] = expected;
    this['actual'] = actual;
    Object.setPrototypeOf(this, ArtifactFormatError.prototype);
  }
}

export class ArtifactVersionError extends Error {
  readonly code: 'ARTIFACT_VERSION';
  readonly field: 'format' | 'opcode';
  readonly expected: string;
  readonly actual: string;
  readonly display: 'ArtifactVersionError';

  constructor(message: string, field: 'format' | 'opcode', expected: string, actual: string) {
    super(message);
    this.name = 'ArtifactVersionError';
    this['code'] = 'ARTIFACT_VERSION';
    this['display'] = 'ArtifactVersionError';
    this['field'] = field;
    this['expected'] = expected;
    this['actual'] = actual;
    Object.setPrototypeOf(this, ArtifactVersionError.prototype);
  }
}

export class ArtifactLoadError extends Error {
  readonly code: 'ARTIFACT_LOAD';
  readonly display: 'ArtifactLoadError';

  constructor(message: string) {
    super(message);
    this.name = 'ArtifactLoadError';
    this['code'] = 'ARTIFACT_LOAD';
    this['display'] = 'ArtifactLoadError';
    Object.setPrototypeOf(this, ArtifactLoadError.prototype);
  }
}

export class CompileError extends Error {
  readonly code: 'COMPILE_ERROR';
  readonly filename?: string;
  readonly display: 'CompileError';

  constructor(message: string, filename?: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'CompileError';
    this['code'] = 'COMPILE_ERROR';
    this['display'] = 'CompileError';
    this['filename'] = filename;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
    Object.setPrototypeOf(this, CompileError.prototype);
  }
}
